export enum QuoteStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

// Service types enum
export enum ServiceType {
  STORES = 'STORES',
  SPARES = 'SPARES',
  AGENCY = 'AGENCY',
  CREWING = 'CREWING',
  BUNKERING = 'BUNKERING',
  CTM = 'CTM'
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  [ServiceType.STORES]: 'Stores',
  [ServiceType.SPARES]: 'Spares',
  [ServiceType.AGENCY]: 'Agency',
  [ServiceType.CREWING]: 'Crewing',
  [ServiceType.BUNKERING]: 'Bunkering',
  [ServiceType.CTM]: 'CTM',
};

export interface Vendor {
  id: string;
  name: string; // Company Name
  primaryEmail: string;
  secondaryEmail?: string;
  commonEmail?: string;
  additionalEmail?: string;
  phone?: string;
  address?: string;
  serviceTypes: ServiceType[]; // Types of service (Multiselection)
  serviceCountries: string[]; // Countries service available (Multiselection)
  rating?: number; // Rating (1-5)
  isBlacklisted: boolean; // Blacklisted (yes/no)
  blacklistReason?: string; // Reason for blacklisting
  contactPerson?: string;
  isActive: boolean;
  umbrellaCompanyId: string; // Belongs to umbrella company
  createdAt: Date;
  updatedAt: Date;
  quotes?: VendorQuote[];

  // Legacy fields for backward compatibility
  email: string; // Maps to primaryEmail
  country: string; // Maps to first entry in serviceCountries
  city?: string;
}

export interface VendorQuote {
  id: string;
  requisitionId: string;
  vendorId: string;
  quoteNumber?: string;
  quotedItems?: VendorQuoteItem[];
  totalAmount?: number;
   grossAmountBeforeDiscount?: number;
   netAmountAfterDiscount?: number;
  currency: string;
  validUntil?: Date;
  status: QuoteStatus;
  notes?: string;
  attachments?: string; // JSON array of file paths
  sentAt?: Date;
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  requisition?: {
    id: string;
    requisitionNumber: string;
    heading: string;
  };
  vendor?: Vendor;
}

export interface VendorQuoteItem {
  id: string;
  quoteId: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalPrice?: number;
  deliveryTime?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVendorData {
  name: string; // Company Name
  primaryEmail: string;
  secondaryEmail?: string;
  commonEmail?: string;
  additionalEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
  serviceTypes: ServiceType[]; // Types of service (Multiselection)
  serviceCountries: string[]; // Countries service available (Multiselection)
  rating?: number; // Rating (1-5)
  isBlacklisted?: boolean; // Blacklisted (yes/no)
  blacklistReason?: string; // Reason for blacklisting
  contactPerson?: string;
  isActive?: boolean;
  umbrellaCompanyId: string; // Belongs to umbrella company
}

export interface UpdateVendorData extends Partial<CreateVendorData> {
  id: string;
}

export interface RateVendorData {
  rating: number; // Rating (1-5)
}

export interface BlacklistVendorData {
  isBlacklisted: boolean;
  blacklistReason?: string;
}

export interface VendorFilters {
  search?: string;
  country?: string;
  serviceType?: ServiceType;
  isActive?: boolean;
  isBlacklisted?: boolean;
  rating?: number;
  umbrellaCompanyId?: string;
}

export interface PaginatedVendors {
  vendors: Vendor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SendQuoteRequest {
  requisitionId: string;
  vendorIds: string[];
  validUntilDays?: number;
  customMessage?: string;
}

export interface QuoteRequestFilters {
  search?: string;
  country?: string;
  deliveryLocation?: string;
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  [QuoteStatus.PENDING]: 'Pending',
  [QuoteStatus.SENT]: 'Sent',
  [QuoteStatus.RECEIVED]: 'Received',
  [QuoteStatus.APPROVED]: 'Approved',
  [QuoteStatus.REJECTED]: 'Rejected',
  [QuoteStatus.DECLINED]: 'Declined',
  [QuoteStatus.EXPIRED]: 'Expired',
};

export const COUNTRY_LIST = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
  'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei',
  'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde',
  'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo',
  'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'East Timor', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea',
  'Eritrea', 'Estonia', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia',
  'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'North Korea',
  'South Korea', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
  'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macedonia', 'Madagascar', 'Malawi',
  'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius',
  'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
  'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Panama', 'Papua New Guinea', 'Paraguay',
  'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa',
  'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
  'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia',
  'South Africa', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Swaziland', 'Sweden',
  'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga',
  'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

// Helper function to format currency
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

// Helper function to check if quote is expired
export const isQuoteExpired = (validUntil?: Date): boolean => {
  if (!validUntil) return false;
  return new Date() > new Date(validUntil);
};

// Helper function to get quote status color
export const getQuoteStatusColor = (status: QuoteStatus): string => {
  switch (status) {
    case QuoteStatus.PENDING:
      return 'bg-red-100 text-red-800';
    case QuoteStatus.SENT:
      return 'bg-blue-100 text-blue-800';
    case QuoteStatus.RECEIVED:
      return 'bg-green-100 text-green-800';
    case QuoteStatus.APPROVED:
      return 'bg-emerald-100 text-emerald-800';
    case QuoteStatus.REJECTED:
      return 'bg-red-100 text-red-800';
    case QuoteStatus.DECLINED:
      return 'bg-red-100 text-red-800';
    case QuoteStatus.EXPIRED:
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};
