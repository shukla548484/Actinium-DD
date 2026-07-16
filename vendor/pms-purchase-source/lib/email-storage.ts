import { getGmailClient } from './gmail-server';
import { prisma } from './prisma';
import { downloadAttachment } from './email-polling';

/**
 * Store email message in database
 */
/**
 * Store email message in database with complete process flow:
 * 1. Check if email has Excel attachment
 * 2. If yes, parse Excel and update quote from respective vendor
 * 3. Upload attachment to Google Cloud Storage with download link
 * 4. Store email in database
 * 5. Confirm email copied to database
 * 6. Confirm attachment copied to Google Cloud Storage
 * 7. Update quote comparison data
 * 8. Return confirmation with any errors
 */
export async function storeEmailMessage(messageId: string, emailType?: string, relatedRequisitionId?: string, relatedQuoteId?: string) {
  const processSteps = {
    emailStored: false,
    attachmentUploaded: false,
    quoteUpdated: false,
    errors: [] as string[],
  };

  try {
    console.log(`📧 [STEP 1] Starting email storage process for: ${messageId}`, {
      emailType,
      relatedRequisitionId,
      relatedQuoteId,
    });

    const gmail = await getGmailClient();

    // Check if email already exists
    const existing = await prisma.emailMessage.findUnique({
      where: { messageId },
      include: { attachments: true },
    });

    if (existing) {
      console.log(`ℹ️  Email ${messageId} already exists in database`);
      // If email exists but is not processed and has Excel attachment, trigger processing
      if (!existing.processed && existing.hasAttachment) {
        const hasExcelAttachment = existing.attachments.some(att => 
          att.filename.endsWith('.xlsx') || att.filename.endsWith('.xls')
        );
        if (hasExcelAttachment) {
          console.log(`🔄 Email exists but not processed - enqueueing quote import job...`);
          try {
            const { enqueueQuoteImportJob } = await import("@/lib/emails/quote-import-queue");
            await enqueueQuoteImportJob(existing.id, { priority: 2 });
          } catch (error) {
            console.error(`❌ Error enqueueing quote import for existing email ${existing.id}:`, error);
          }
        }
      }
      return existing;
    }

    // Get full message from Gmail
    let message;
    try {
      message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });
      console.log(`✅ Retrieved email message from Gmail: ${messageId}`);
    } catch (gmailError: any) {
      console.error(`❌ Error fetching email from Gmail API:`, gmailError);
      throw new Error(`Failed to fetch email from Gmail: ${gmailError.message || 'Unknown error'}`);
    }

    const headers = message.data.payload?.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
    };

    const from = getHeader('From');
    const to = getHeader('To') || '';
    const cc = getHeader('Cc') || '';
    const bcc = getHeader('Bcc') || '';
    let subject = getHeader('Subject');
    const dateHeader = getHeader('Date');
    let receivedAt = dateHeader ? new Date(dateHeader) : new Date();
    const snippet = message.data.snippet || '';

    // Validate required fields
    if (!from || from.trim() === '') {
      throw new Error(`Email ${messageId} is missing 'From' field`);
    }
    if (!subject || subject.trim() === '') {
      console.warn(`⚠️  Email ${messageId} has empty subject, using '(No Subject)'`);
      subject = '(No Subject)';
    }
    
    // Validate date
    if (isNaN(receivedAt.getTime())) {
      console.warn(`⚠️  Email ${messageId} has invalid date, using current date`);
      receivedAt = new Date();
    }

    // Extract body
    let bodyHtml = '';
    let bodyText = '';
    const attachments: Array<{
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
    }> = [];

    const extractBody = (part: any) => {
      if (part.body && part.body.data) {
        const data = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
        const content = Buffer.from(data, 'base64').toString();

        if (part.mimeType === 'text/html') {
          bodyHtml = content;
        } else if (part.mimeType === 'text/plain') {
          bodyText = content;
        }
      }

      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }

      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    extractBody(message.data.payload);

    // Parse addresses
    const parseAddresses = (addressString: string): string[] => {
      if (!addressString) return [];
      return addressString.split(',').map(addr => addr.trim());
    };

    // Parse addresses
    const toAddresses = parseAddresses(to);
    const ccAddresses = parseAddresses(cc);
    const bccAddresses = parseAddresses(bcc);
    const labelsArray = Array.isArray(message.data.labelIds) ? message.data.labelIds : [];

    // Store email message
    // Use the messageId parameter (which is the Gmail message ID) instead of message.id
    // because Gmail API returns message.data.id, not message.id
    const gmailMessageId = message.data.id || messageId;
    const gmailThreadId = message.data.threadId || null;
    
    console.log(`📧 Creating email record:`, {
      messageId: gmailMessageId,
      threadId: gmailThreadId,
      from,
      to: toAddresses,
      subject,
      attachmentsCount: attachments.length,
      receivedAt: receivedAt.toISOString(),
    });

    try {
      const emailMessage = await prisma.emailMessage.create({
        data: {
          messageId: gmailMessageId,
          threadId: gmailThreadId,
          from: from.trim(),
          to: toAddresses,
          cc: ccAddresses,
          bcc: bccAddresses,
          subject: subject.trim(),
          bodyHtml: bodyHtml || null,
          bodyText: bodyText || null,
          snippet: snippet || null,
          receivedAt,
          sentAt: receivedAt, // For received emails, sentAt = receivedAt
          labels: labelsArray,
          isRead: labelsArray.includes('UNREAD') ? false : true,
          isStarred: labelsArray.includes('STARRED') || false,
          hasAttachment: attachments.length > 0,
          relatedRequisitionId: relatedRequisitionId || null,
          relatedQuoteId: relatedQuoteId || null,
          emailType: emailType || null,
          processed: false,
          processingStatus: 'RECEIVED',
        },
      });

      console.log(`✅ Email message stored in database: ${emailMessage.id}`);

      // Store attachments - ALWAYS upload to Google Cloud Storage
      if (attachments.length > 0) {
        for (const att of attachments) {
          try {
            // Download attachment first
            let fileData: Buffer | null = null;
            let fileUrl: string | null = null;
            let storageType: string = 'GOOGLE_CLOUD_STORAGE';

            console.log(`📧 Processing attachment: ${att.filename} (${(att.size / 1024).toFixed(1)} KB)`);

            // Download attachment from Gmail
            try {
              fileData = await downloadAttachment(messageId, att.attachmentId);
              console.log(`✅ Downloaded attachment: ${att.filename}`);
            } catch (downloadError: any) {
              console.error(`❌ Error downloading attachment ${att.filename}:`, downloadError);
              // Continue with GMAIL_API storage type if download fails
              storageType = 'GMAIL_API';
            }

            // Try to upload to Google Cloud Storage (for all attachments)
            if (fileData && att.size < 50 * 1024 * 1024) { // Upload files < 50MB to GCS
              try {
                const { getGoogleCloudStorageService } = await import('./google-cloud-storage');
                const gcs = getGoogleCloudStorageService();
                
                // Get vessel info if we have requisition/quote context
                let vesselId: string | undefined;
                let fileName = att.filename;
                
                if (relatedQuoteId) {
                  const quote = await prisma.vendorQuote.findUnique({
                    where: { id: relatedQuoteId },
                    include: {
                      requisition: {
                        include: { vessel: true },
                      },
                      vendor: true,
                    },
                  });
                  
                  if (quote) {
                    vesselId = quote.requisition.vesselId;
                    const requisitionNumber = quote.requisition.requisitionNumber;
                    const vendorName = quote.vendor.name;
                    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
                    const sanitizedVendorName = vendorName.replace(/[^a-zA-Z0-9]/g, '_') || 'Vendor';
                    const sanitizedReqNumber = requisitionNumber.replace(/[^a-zA-Z0-9.-]/g, '_') || 'REQ';
                    fileName = `Quote_Response_${sanitizedReqNumber}_${sanitizedVendorName}_${timestamp}.xlsx`;
                  }
                } else if (relatedRequisitionId) {
                  const requisition = await prisma.requisition.findUnique({
                    where: { id: relatedRequisitionId },
                    include: { vessel: true },
                  });
                  
                  if (requisition) {
                    vesselId = requisition.vesselId;
                  }
                } else {
                  // For emails without requisition context, try to extract vessel from email
                  // Check if email subject or body contains vessel info
                  const vesselMatch = subject.match(/\b([A-Z]{4})\b/); // Look for 4-letter vessel codes
                  if (vesselMatch) {
                    const vesselCode = vesselMatch[1];
                    const vessel = await prisma.vessel.findFirst({
                      where: { code: vesselCode },
                      select: { id: true },
                    });
                    if (vessel) {
                      vesselId = vessel.id;
                    }
                  }
                }
                
                // Upload to GCS
                const uploadResult = await gcs.uploadFile(
                  fileData,
                  fileName,
                  att.mimeType || 'application/octet-stream',
                  {
                    vesselId,
                    category: 'purchase',
                    subfolder: `email-attachments${relatedRequisitionId ? `/${relatedRequisitionId}` : ''}${relatedQuoteId ? `/${relatedQuoteId}` : ''}`,
                  }
                );
                
                fileUrl = uploadResult.fileUrl;
                storageType = 'GOOGLE_CLOUD_STORAGE';
                const gcsObjectPath = uploadResult.fileName;
                console.log(`✅ Attachment uploaded to Google Cloud Storage: ${fileUrl}`);
                
                // Clear fileData to save database space (file is now in GCS)
                fileData = null;

                const attachmentRecord = await prisma.emailAttachment.create({
                  data: {
                    emailMessageId: emailMessage.id,
                    attachmentId: att.attachmentId,
                    filename: att.filename,
                    mimeType: att.mimeType,
                    size: att.size,
                    fileData: null,
                    fileUrl: fileUrl,
                    gcsObjectPath,
                    storageType: storageType,
                    relatedRequisitionId: relatedRequisitionId || null,
                    relatedQuoteId: relatedQuoteId || null,
                  },
                });
                
                console.log(`✅ [STEP 3] Attachment stored in database: ${att.filename} (${storageType}${fileUrl ? ` - ${fileUrl}` : ''})`);
                
                if (fileUrl) {
                  console.log(`✅ [STEP 5 CONFIRMED] Attachment copied to Google Cloud Storage with download link: ${fileUrl}`);
                  processSteps.attachmentUploaded = true;
                }
                continue;
              } catch (gcsError: any) {
                console.error(`⚠️  Error uploading attachment to GCS:`, gcsError);
                // Fallback: keep fileData for database storage if < 10MB
                if (att.size >= 10 * 1024 * 1024) {
                  // For larger files, use Gmail API reference
                  fileData = null;
                  storageType = 'GMAIL_API';
                } else {
                  // Store in database as fallback
                  storageType = 'DATABASE';
                  console.log(`📦 Storing attachment in database as fallback: ${att.filename}`);
                }
              }
            } else if (att.size >= 50 * 1024 * 1024) {
              // For very large files (> 50MB), use Gmail API reference
              fileData = null;
              storageType = 'GMAIL_API';
              console.log(`📎 Large attachment (>50MB), using Gmail API reference: ${att.filename}`);
            } else if (!fileData) {
              // If download failed, use Gmail API reference
              storageType = 'GMAIL_API';
              console.log(`📎 Using Gmail API reference for attachment: ${att.filename}`);
            } else {
              // Store in database if GCS upload failed and file is small
              storageType = 'DATABASE';
              console.log(`📦 Storing attachment in database: ${att.filename}`);
            }

            const attachmentRecord = await prisma.emailAttachment.create({
              data: {
                emailMessageId: emailMessage.id,
                attachmentId: att.attachmentId,
                filename: att.filename,
                mimeType: att.mimeType,
                size: att.size,
                fileData: fileData ? new Uint8Array(fileData) : null,
                fileUrl: fileUrl,
                storageType: storageType,
                relatedRequisitionId: relatedRequisitionId || null,
                relatedQuoteId: relatedQuoteId || null,
              },
            });
            
            console.log(`✅ [STEP 3] Attachment stored in database: ${att.filename} (${storageType}${fileUrl ? ` - ${fileUrl}` : ''})`);
            
            if (fileUrl) {
              console.log(`✅ [STEP 5 CONFIRMED] Attachment copied to Google Cloud Storage with download link: ${fileUrl}`);
              processSteps.attachmentUploaded = true;
            }
          } catch (error: any) {
            const errorMsg = `Error storing attachment ${att.filename}: ${error.message}`;
            console.error(`❌ ${errorMsg}`);
            processSteps.errors.push(errorMsg);
            // Continue with other attachments even if one fails
          }
        }
        
        if (processSteps.attachmentUploaded) {
          console.log(`✅ [STEP 5 CONFIRMED] All attachments successfully copied to Google Cloud Storage`);
        }
      }

      console.log(`✅ [STEP 4 CONFIRMED] Successfully stored email ${messageId} with ${attachments.length} attachment(s) in database`);
      processSteps.emailStored = true;
      
      // STEP 1: Check if email has Excel attachment and process quote
      // IMPORTANT: Wait for all attachments to be stored before processing
      if (emailMessage.hasAttachment && attachments.length > 0) {
        const hasExcelAttachment = attachments.some(att => 
          att.filename.endsWith('.xlsx') || att.filename.endsWith('.xls')
        );
        
        if (hasExcelAttachment) {
          console.log(`📊 [STEP 1] Excel attachment found - will process quote after attachments are stored`);
          console.log(`   Email ID: ${emailMessage.id}, Message ID: ${emailMessage.messageId}`);
          console.log(`   Subject: ${emailMessage.subject}`);
          console.log(`   From: ${emailMessage.from}`);
          
          try {
            const maxAttempts = 5;
            const delayMs = 200;
            let storedEmail = null as any;
            let attempt = 0;

            while (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
              attempt += 1;

              const candidate = await prisma.emailMessage.findUnique({
                where: { id: emailMessage.id },
                include: {
                  attachments: {
                    where: {
                      OR: [
                        { filename: { endsWith: '.xlsx' } },
                        { filename: { endsWith: '.xls' } },
                      ],
                    },
                  },
                },
              });

              if (!candidate) {
                storedEmail = candidate;
                break;
              }

              if (candidate.attachments && candidate.attachments.length > 0) {
                const excelAttachment = candidate.attachments[0];
                const hasFileData = excelAttachment.fileData && excelAttachment.fileData.length > 0;
                const hasFileUrl = excelAttachment.fileUrl && excelAttachment.fileUrl.length > 0;
                const isReady = hasFileData || hasFileUrl || excelAttachment.storageType === 'GMAIL_API';
                if (isReady) {
                  storedEmail = candidate;
                  break;
                }
              }

              storedEmail = candidate;
            }
            
            if (!storedEmail) {
              console.error(`❌ Email ${emailMessage.id} not found in database during auto-processing`);
              processSteps.errors.push(`Email not found during auto-processing`);
            } else if (storedEmail.processed) {
              console.log(`ℹ️  Email ${emailMessage.id} already processed, skipping auto-processing`);
            } else if (!storedEmail.attachments || storedEmail.attachments.length === 0) {
              console.warn(`⚠️  Excel attachment not found in database for email ${emailMessage.id}`);
              console.warn(`   This might mean the attachment storage is still in progress`);
              console.warn(`   Will retry via auto-process endpoint or manual processing`);
              // Don't mark as error - attachment might still be uploading
            } else {
              // Verify attachment has fileData or fileUrl
              const excelAttachment = storedEmail.attachments[0];
              const hasFileData = excelAttachment.fileData && excelAttachment.fileData.length > 0;
              const hasFileUrl = excelAttachment.fileUrl && excelAttachment.fileUrl.length > 0;
              
              if (!hasFileData && !hasFileUrl && excelAttachment.storageType !== 'GMAIL_API') {
                console.warn(`⚠️  Excel attachment ${excelAttachment.id} has no fileData or fileUrl`);
                console.warn(`   Storage type: ${excelAttachment.storageType}`);
                console.warn(`   Will retry via auto-process endpoint or manual processing`);
              } else {
                console.log(`✅ Excel attachment verified in database: ${excelAttachment.filename}`);
                console.log(`   Attachment ID: ${excelAttachment.id}`);
                console.log(`   Storage type: ${excelAttachment.storageType}`);
                console.log(`   Has fileData: ${hasFileData}, Has fileUrl: ${hasFileUrl}`);

                const { enqueueQuoteImportJob } = await import("@/lib/emails/quote-import-queue");
                console.log(`📥 [STEP 1] Enqueueing quote import job for email ${emailMessage.id}...`);
                const enqueueResult = await enqueueQuoteImportJob(emailMessage.id, {
                  priority: 2,
                });
                if (enqueueResult.enqueued) {
                  console.log(`✅ Quote import job queued: ${enqueueResult.jobId}`);
                } else {
                  console.log(`ℹ️  Quote import job not enqueued (already done or not a candidate)`);
                }
              }
            }
          } catch (error: any) {
            const errorMsg = `Error auto-processing quote: ${error.message}`;
            console.error(`❌ ${errorMsg}`);
            console.error(`   Error stack: ${error.stack}`);
            processSteps.errors.push(errorMsg);
            // Don't throw - allow email storage to complete even if processing fails
          }
        }
      }
      
      // Return email with process confirmation
      const result = {
        ...emailMessage,
        processConfirmation: {
          emailStored: processSteps.emailStored,
          attachmentUploaded: processSteps.attachmentUploaded,
          quoteUpdated: processSteps.quoteUpdated,
          errors: processSteps.errors,
        },
      };
      
      console.log(`✅ [PROCESS COMPLETE] Email storage process finished for ${messageId}:`, {
        emailStored: processSteps.emailStored,
        attachmentUploaded: processSteps.attachmentUploaded,
        quoteUpdated: processSteps.quoteUpdated,
        errorCount: processSteps.errors.length,
      });
      
      return result;
    } catch (dbError: any) {
      console.error(`❌ [ERROR] Database error storing email ${messageId}:`, dbError);
      processSteps.errors.push(`Database error: ${dbError.message}`);
      console.error('Database error details:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta,
        stack: dbError.stack,
      });
      throw dbError;
    }
  } catch (error: any) {
    console.error(`❌ Error storing email message ${messageId}:`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data,
    });
    
    // Re-throw with more context
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || error.response?.status;
    throw new Error(`Failed to store email ${messageId}: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ''}`);
  }
}

/**
 * Get email attachment from database
 */
export async function getEmailAttachment(attachmentId: string) {
  return await prisma.emailAttachment.findUnique({
    where: { id: attachmentId },
    include: { emailMessage: true },
  });
}

/**
 * Get emails related to a requisition
 */
export async function getRequisitionEmails(requisitionId: string) {
  return await prisma.emailMessage.findMany({
    where: { relatedRequisitionId: requisitionId },
    include: { attachments: true },
    orderBy: { receivedAt: 'desc' },
  });
}

/**
 * Get emails related to a quote
 */
export async function getQuoteEmails(quoteId: string) {
  return await prisma.emailMessage.findMany({
    where: { relatedQuoteId: quoteId },
    include: { attachments: true },
    orderBy: { receivedAt: 'desc' },
  });
}



