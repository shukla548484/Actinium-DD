"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  COUNTRY_DIAL_CODES,
  countrySelectLabel,
  getCountryByDialCode,
  getCountryByIso2,
} from "@/lib/admin/countries";
import { isValidLocalPhoneNumber } from "@/lib/admin/phone";
import { cn } from "@/lib/utils";

type PhoneNumberFieldProps = {
  dialCode: string;
  localNumber: string;
  onDialCodeChange: (dialCode: string) => void;
  onLocalNumberChange: (localNumber: string) => void;
  className?: string;
  localId?: string;
};

function defaultCountryIso(dialCode: string): string {
  return COUNTRY_DIAL_CODES.find((c) => c.dialCode === dialCode)?.iso2 ?? "IN";
}

export function PhoneNumberField({
  dialCode,
  localNumber,
  onDialCodeChange,
  onLocalNumberChange,
  className,
  localId,
}: PhoneNumberFieldProps) {
  const [countryIso, setCountryIso] = useState(() => defaultCountryIso(dialCode));

  useEffect(() => {
    const selected = getCountryByIso2(countryIso);
    if (selected?.dialCode === dialCode) return;
    setCountryIso(defaultCountryIso(dialCode));
  }, [dialCode, countryIso]);

  const countryItems = useMemo(
    () =>
      COUNTRY_DIAL_CODES.map((country) => ({
        value: country.iso2,
        label: countrySelectLabel(country),
        searchText: `${country.name} ${country.iso2} +${country.dialCode}`,
      })),
    [],
  );

  const localInvalid = localNumber.length > 0 && !isValidLocalPhoneNumber(localNumber);
  const selectedCountry = getCountryByIso2(countryIso) ?? getCountryByDialCode(dialCode);

  return (
    <div className={cn("flex flex-row gap-2", className)}>
      <SearchableSelect
        items={countryItems}
        value={countryIso}
        onValueChange={(iso2) => {
          setCountryIso(iso2);
          const country = getCountryByIso2(iso2);
          if (country) onDialCodeChange(country.dialCode);
        }}
        placeholder="Country"
        searchPlaceholder="Search country or code…"
        className="w-[14rem] shrink-0"
      />
      <Input
        id={localId}
        inputMode="numeric"
        autoComplete="tel-national"
        value={localNumber}
        maxLength={10}
        placeholder="10-digit number"
        aria-invalid={localInvalid}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
          onLocalNumberChange(digits);
        }}
        className="min-w-0 flex-1"
      />
      {selectedCountry ? (
        <span className="sr-only">Country code +{selectedCountry.dialCode}</span>
      ) : null}
    </div>
  );
}
