"use client";

import { CustomField } from "@/lib/catalog";

interface Props {
  fields: CustomField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white";

export default function CustomFieldInputs({ fields, values, onChange }: Props) {
  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {field.label} <span className="text-red-400">*</span>
          </label>
          {field.options ? (
            <select
              value={values[field.key]}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={inputClass}
            >
              <option value="">Select {field.label.toLowerCase()}</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={values[field.key]}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              className={inputClass}
            />
          )}
        </div>
      ))}
    </div>
  );
}
