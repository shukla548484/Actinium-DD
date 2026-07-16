"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, User, X, Star, AlertTriangle } from "lucide-react";
import { 
  CreateVendorData, 
  Vendor, 
  COUNTRY_LIST, 
  ServiceType, 
  SERVICE_TYPE_LABELS 
} from "@/lib/types/vendor";

const vendorFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  primaryEmail: z.string().email("Valid primary email is required"),
  secondaryEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  commonEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  additionalEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  serviceTypes: z.array(z.nativeEnum(ServiceType)).min(1, "At least one service type is required"),
  serviceCountries: z.array(z.string()).min(1, "At least one service country is required"),
  rating: z.number().min(1).max(5).optional(),
  isBlacklisted: z.boolean(),
  blacklistReason: z.string().optional(),
  contactPerson: z.string().optional(),
  isActive: z.boolean(),
  umbrellaCompanyId: z.string().min(1, "Umbrella company is required"),
});

type VendorFormData = z.infer<typeof vendorFormSchema>;

interface VendorFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateVendorData) => Promise<void>;
  editing?: Vendor | null;
  isSubmitting?: boolean;
  umbrellaCompanyId: string;
}

export default function VendorForm({
  open,
  onClose,
  onSubmit,
  editing,
  isSubmitting = false,
  umbrellaCompanyId,
}: VendorFormProps) {
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<ServiceType[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [showBlacklistReason, setShowBlacklistReason] = useState(false);
  const [selectCountryValue, setSelectCountryValue] = useState<string>("");

  const form = useForm<VendorFormData>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: "",
      primaryEmail: "",
      secondaryEmail: "",
      commonEmail: "",
      additionalEmail: "",
      phone: "",
      address: "",
      serviceTypes: [],
      serviceCountries: [],
      rating: undefined,
      isBlacklisted: false,
      blacklistReason: "",
      contactPerson: "",
      isActive: true,
      umbrellaCompanyId,
    },
  });

  // Reset form when editing changes
  useEffect(() => {
    if (editing) {
      const serviceTypes = editing.serviceTypes || [];
      const serviceCountries = editing.serviceCountries || [];
      
      setSelectedServiceTypes(serviceTypes);
      setSelectedCountries(serviceCountries);
      setShowBlacklistReason(editing.isBlacklisted || false);
      
      form.reset({
        name: editing.name,
        primaryEmail: editing.primaryEmail,
        secondaryEmail: editing.secondaryEmail || "",
        commonEmail: editing.commonEmail || "",
        additionalEmail: editing.additionalEmail || "",
        phone: editing.phone || "",
        address: editing.address || "",
        serviceTypes,
        serviceCountries,
        rating: editing.rating,
        isBlacklisted: editing.isBlacklisted || false,
        blacklistReason: editing.blacklistReason || "",
        contactPerson: editing.contactPerson || "",
        isActive: editing.isActive,
        umbrellaCompanyId: editing.umbrellaCompanyId,
      });
    } else {
      setSelectedServiceTypes([]);
      setSelectedCountries([]);
      setShowBlacklistReason(false);
      
      form.reset({
        name: "",
        primaryEmail: "",
        secondaryEmail: "",
        commonEmail: "",
        additionalEmail: "",
        phone: "",
        address: "",
        serviceTypes: [],
        serviceCountries: [],
        rating: undefined,
        isBlacklisted: false,
        blacklistReason: "",
        contactPerson: "",
        isActive: true,
        umbrellaCompanyId,
      });
    }
  }, [editing, form, umbrellaCompanyId]);

  // Helper functions for multiselect
  const toggleServiceType = (serviceType: ServiceType) => {
    const newSelected = selectedServiceTypes.includes(serviceType)
      ? selectedServiceTypes.filter(s => s !== serviceType)
      : [...selectedServiceTypes, serviceType];
    
    setSelectedServiceTypes(newSelected);
    form.setValue('serviceTypes', newSelected);
  };
  
  const toggleCountry = (country: string) => {
    if (!country || country.trim() === '') return;
    
    const newSelected = selectedCountries.includes(country)
      ? selectedCountries.filter(c => c !== country)
      : [...selectedCountries, country];
    
    setSelectedCountries(newSelected);
    form.setValue('serviceCountries', newSelected);
    // Reset select value to allow selecting again
    setSelectCountryValue("");
  };
  
  const removeServiceType = (serviceType: ServiceType) => {
    const newSelected = selectedServiceTypes.filter(s => s !== serviceType);
    setSelectedServiceTypes(newSelected);
    form.setValue('serviceTypes', newSelected);
  };
  
  const removeCountry = (country: string) => {
    const newSelected = selectedCountries.filter(c => c !== country);
    setSelectedCountries(newSelected);
    form.setValue('serviceCountries', newSelected);
  };

  const handleSubmit = (data: VendorFormData) => {
    // Ensure serviceCountries is properly included - use selectedCountries state which is the source of truth
    const submitData = {
      ...data,
      serviceCountries: selectedCountries.length > 0 ? selectedCountries : (data.serviceCountries || []),
      serviceTypes: selectedServiceTypes.length > 0 ? selectedServiceTypes : (data.serviceTypes || []),
    };
    
    // Ensure serviceCountries is an array
    if (!Array.isArray(submitData.serviceCountries)) {
      submitData.serviceCountries = [];
    }
    
    // Ensure serviceTypes is an array
    if (!Array.isArray(submitData.serviceTypes)) {
      submitData.serviceTypes = [];
    }
    
    // Log for debugging
    console.log('[VendorForm] Submitting data:', {
      ...submitData,
      serviceCountriesCount: submitData.serviceCountries?.length || 0,
      serviceCountries: submitData.serviceCountries,
      selectedCountries: selectedCountries,
    });
    
    onSubmit(submitData);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-14">
            <User className="h-5 w-5" />
            {editing ? "Edit Vendor" : "Add New Vendor"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editing
              ? "Update the vendor information below."
              : "Add a new vendor to your database. All vendors will be available for quote requests."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-14 font-semibold text-gray-900">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Company Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter company name" 
                          {...field}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-10" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Contact Person</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Primary contact name" 
                          {...field}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-10" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-14 font-semibold text-gray-900">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Primary Email *</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="primary@company.com" 
                          {...field}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-10" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondaryEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Secondary Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="secondary@company.com" 
                          {...field}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-10" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commonEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Common Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="info@company.com" 
                          {...field}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-10" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additionalEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Additional Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="additional@company.com" 
                          {...field}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-10" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Phone Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="+1 (555) 123-4567" 
                          {...field}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-10" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter complete address"
                        className="min-h-[80px] text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-10" />
                  </FormItem>
                )}
              />
            </div>

            {/* Service Information */}
            <div className="space-y-4">
              <h3 className="text-14 font-semibold text-gray-900">Service Information</h3>
              
              {/* Service Types */}
              <FormField
                control={form.control}
                name="serviceTypes"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Types of Service *</FormLabel>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={key}
                              checked={selectedServiceTypes.includes(key as ServiceType)}
                              onCheckedChange={() => toggleServiceType(key as ServiceType)}
                              className="text-xs"
                            />
                            <label htmlFor={key} className="text-xs cursor-pointer">
                              {label}
                            </label>
                          </div>
                        ))}
                      </div>
                      
                      {selectedServiceTypes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedServiceTypes.map((serviceType) => (
                            <Badge key={serviceType} variant="secondary" className="text-10">
                              {SERVICE_TYPE_LABELS[serviceType]}
                              <button
                                type="button"
                                onClick={() => removeServiceType(serviceType)}
                                className="ml-2 hover:text-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormMessage className="text-10" />
                  </FormItem>
                )}
              />

              {/* Service Countries */}
              <FormField
                control={form.control}
                name="serviceCountries"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Countries Service Available *</FormLabel>
                    <div className="space-y-3">
                      <Select 
                        onValueChange={(country) => {
                          toggleCountry(country);
                        }}
                        value={selectCountryValue}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Select countries where service is available" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_LIST.filter(country => !selectedCountries.includes(country)).map((country) => (
                            <SelectItem key={country} value={country} className="text-xs">
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {selectedCountries.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedCountries.map((country) => (
                            <Badge key={country} variant="outline" className="text-10">
                              {country}
                              <button
                                type="button"
                                onClick={() => removeCountry(country)}
                                className="ml-2 hover:text-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormMessage className="text-10" />
                  </FormItem>
                )}
              />
            </div>

            {/* Rating and Status */}
            <div className="space-y-4">
              <h3 className="text-14 font-semibold text-gray-900">Rating and Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Rating (1-5)</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString() || ""}>
                        <FormControl>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Select rating" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__empty__" className="text-xs">No rating</SelectItem>
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <SelectItem key={rating} value={rating.toString()} className="text-xs">
                              <div className="flex items-center">
                                {Array.from({ length: rating }).map((_, i) => (
                                  <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                ))}
                                <span className="ml-2">{rating} Star{rating !== 1 ? 's' : ''}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-10" />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-xs font-medium">
                            Active Vendor
                          </FormLabel>
                          <p className="text-10 text-gray-600">
                            Active vendors will appear in quote request selections
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isBlacklisted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              setShowBlacklistReason(!!checked);
                            }}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-xs font-medium flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1 text-red-500" />
                            Blacklist Vendor
                          </FormLabel>
                          <p className="text-10 text-gray-600">
                            Blacklisted vendors will be excluded from future requests
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {showBlacklistReason && (
                <FormField
                  control={form.control}
                  name="blacklistReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Blacklist Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter reason for blacklisting this vendor"
                          className="min-h-[60px] text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-10" />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </form>
        </Form>

        <DialogFooter className="flex justify-between">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={form.handleSubmit(handleSubmit)}
            disabled={isSubmitting}
            variant="default"
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300"
          >
            <Save className="h-4 w-4 mr-2" />
            {editing ? "Update Vendor" : "Add Vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}