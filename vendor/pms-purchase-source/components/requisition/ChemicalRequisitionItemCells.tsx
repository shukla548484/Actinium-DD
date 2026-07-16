"use client";

import React from "react";
import type { UseFormReturn, FieldArrayWithId } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequisitionQuantityInput } from "@/components/requisition/RequisitionQuantityInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Check, Paperclip, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CATALOG_LIST_SCROLL_CLASS = "max-h-[11rem] overflow-y-auto";

export type ChemicalCatalogProduct = {
  id: string;
  maker: string;
  productName: string;
  productCode?: string | null;
};

type ChemicalRequisitionItemCellsProps = {
  index: number;
  form: UseFormReturn<any>;
  fields: FieldArrayWithId[];
  requisitionChemicalMaker: string;
  chemicalMakers: string[];
  chemicalManualMakerMode: boolean;
  chemicalManualMakerValue: string;
  setChemicalManualMakerMode: React.Dispatch<React.SetStateAction<boolean>>;
  setChemicalManualMakerValue: React.Dispatch<React.SetStateAction<string>>;
  applyChemicalMakerToAllItems: (maker: string) => void;
  chemicalSearchResults: Record<number, ChemicalCatalogProduct[]>;
  chemicalSearchQuery: Record<number, string>;
  chemicalPopoverOpen: Record<number, boolean>;
  setChemicalSearchQuery: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setChemicalPopoverOpen: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  loadChemicalCatalogProducts: (query: string, itemIndex: number, maker?: string) => Promise<void>;
  handleChemicalSelect: (itemIndex: number, product: ChemicalCatalogProduct) => void;
  itemAttachments: Record<number, File[]>;
  fileInputRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  handleFileSelect: (itemIndex: number, files: FileList | null) => void;
  removeAttachment: (itemIndex: number, fileIndex: number) => void;
  removeItem: (index: number) => void;
  onAddNewProduct: (index: number) => void;
};

export function ChemicalRequisitionItemCells({
  index,
  form,
  fields,
  requisitionChemicalMaker,
  chemicalMakers,
  chemicalManualMakerMode,
  chemicalManualMakerValue,
  setChemicalManualMakerMode,
  setChemicalManualMakerValue,
  applyChemicalMakerToAllItems,
  chemicalSearchResults,
  chemicalSearchQuery,
  chemicalPopoverOpen,
  setChemicalSearchQuery,
  setChemicalPopoverOpen,
  loadChemicalCatalogProducts,
  handleChemicalSelect,
  itemAttachments,
  fileInputRefs,
  handleFileSelect,
  removeAttachment,
  removeItem,
  onAddNewProduct,
}: ChemicalRequisitionItemCellsProps) {
  return (
    <>
      <td className="px-3 py-3">
        {index === 0 ? (
          <FormItem>
            {chemicalManualMakerMode ? (
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    placeholder="Enter chemical maker"
                    className="h-9 text-xs"
                    value={chemicalManualMakerValue}
                    onChange={(e) => {
                      setChemicalManualMakerValue(e.target.value);
                      applyChemicalMakerToAllItems(e.target.value);
                    }}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2"
                  onClick={() => {
                    setChemicalManualMakerMode(false);
                    setChemicalManualMakerValue("");
                    applyChemicalMakerToAllItems("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Select
                onValueChange={(value) => {
                  if (value === "__manual__") {
                    setChemicalManualMakerMode(true);
                    setChemicalManualMakerValue("");
                    applyChemicalMakerToAllItems("");
                  } else {
                    applyChemicalMakerToAllItems(value);
                  }
                }}
                value={requisitionChemicalMaker || undefined}
              >
                <FormControl>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select chemical maker" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {chemicalMakers.map((maker) => (
                    <SelectItem key={maker} value={maker}>
                      {maker}
                    </SelectItem>
                  ))}
                  <SelectItem value="__manual__" className="text-blue-600 font-medium">
                    <Plus className="h-3 w-3 inline mr-1" />
                    Add New Maker
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormItem>
        ) : (
          <Input
            value={requisitionChemicalMaker || "—"}
            disabled
            className="h-9 text-xs bg-slate-50 text-slate-600"
            title="Chemical maker is set once for the whole requisition (row 1)"
          />
        )}
      </td>

      <td className="px-3 py-3">
        <Popover
          open={Boolean(chemicalPopoverOpen[index])}
          onOpenChange={(open) => {
            setChemicalPopoverOpen((prev) => ({ ...prev, [index]: open }));
            if (open && requisitionChemicalMaker.trim()) {
              void loadChemicalCatalogProducts(
                chemicalSearchQuery[index] || "",
                index,
                requisitionChemicalMaker
              );
            }
          }}
        >
          <PopoverTrigger asChild>
            <FormControl>
              <Button
                variant="outline"
                role="combobox"
                className="h-9 w-full justify-between text-left font-normal text-xs"
                type="button"
              >
                {form.watch(`items.${index}.paintProductName`) || "Search chemical product..."}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </FormControl>
          </PopoverTrigger>
          <PopoverContent className="w-[500px] p-0 max-h-[400px]" align="start">
            <Command className="max-h-[400px]">
              <CommandInput
                placeholder="Search by product name or code..."
                value={chemicalSearchQuery[index] || ""}
                onValueChange={(value) => {
                  setChemicalSearchQuery((prev) => ({ ...prev, [index]: value }));
                  if (requisitionChemicalMaker.trim() || value.length >= 2) {
                    void loadChemicalCatalogProducts(value, index, requisitionChemicalMaker);
                  }
                }}
              />
              <CommandEmpty>
                {requisitionChemicalMaker.trim()
                  ? chemicalSearchQuery[index] && chemicalSearchQuery[index].length >= 2
                    ? "No products found. Use Add New Product to register one."
                    : "No registered products for this maker."
                  : chemicalSearchQuery[index] && chemicalSearchQuery[index].length >= 2
                    ? "No products found. Select a maker first or use Add New Product."
                    : "Select a chemical maker to browse products, or type at least 2 characters..."}
              </CommandEmpty>
              {chemicalSearchResults[index] && chemicalSearchResults[index].length > 0 && (
                <CommandGroup className={CATALOG_LIST_SCROLL_CLASS}>
                  {chemicalSearchResults[index].map((product) => (
                    <CommandItem
                      key={product.id}
                      value={`${product.maker} ${product.productName} ${product.productCode || ""}`}
                      onSelect={() => handleChemicalSelect(index, product)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          form.watch(`items.${index}.paintProductName`) === product.productName
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">
                          {product.maker} — {product.productName}
                        </span>
                        {product.productCode?.trim() ? (
                          <span className="text-xs text-slate-600">Code: {product.productCode}</span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </Command>
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAddNewProduct(index)}
                className="w-full text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add New Product
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </td>

      <td className="px-3 py-3">
        <FormField
          control={form.control}
          name={`items.${index}.partNumber`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Product code" {...field} className="h-9 text-xs bg-slate-50" readOnly />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </td>

      <td className="px-3 py-3">
        <FormField
          control={form.control}
          name={`items.${index}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RequisitionQuantityInput
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </td>

      <td className="px-3 py-3">
        <FormField
          control={form.control}
          name={`items.${index}.unit`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="LTR" {...field} className="h-9 text-xs" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </td>

      <td className="px-3 py-3">
        <FormField
          control={form.control}
          name={`items.${index}.remarks`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  placeholder="Remarks (optional)"
                  {...field}
                  value={field.value ?? ""}
                  className="h-9 text-xs"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </td>

      <td className="px-3 py-3">
        <div className="space-y-2">
          <input
            type="file"
            ref={(el) => {
              fileInputRefs.current[index] = el;
            }}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={(e) => handleFileSelect(index, e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRefs.current[index]?.click()}
            className="h-8 w-full text-xs"
          >
            <Paperclip className="h-3 w-3 mr-1" />
            Attach
          </Button>
          {itemAttachments[index] && itemAttachments[index].length > 0 && (
            <div className="space-y-1">
              {itemAttachments[index].map((file, fileIndex) => (
                <div key={fileIndex} className="flex items-center gap-1 bg-slate-50 p-1 rounded text-xs">
                  <span className="truncate flex-1" title={file.name}>
                    {file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index, fileIndex)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>

      <td className="px-3 py-3 text-center">
        {fields.length > 1 && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => removeItem(index)}
            className="h-9"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </td>
    </>
  );
}
