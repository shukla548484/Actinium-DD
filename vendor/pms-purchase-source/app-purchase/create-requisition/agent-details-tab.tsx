"use client";

import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { User } from "lucide-react";

export function AgentDetailsTab() {
  // This component must be used inside RequisitionForm's FormProvider context
  const form = useFormContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5 text-info" />
          Port Agent Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FormField
          control={form.control}
          name="portAgentDetails"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Port Agent Details</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter port agent details, contact information, and other relevant information"
                  className="min-h-[300px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

