'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

interface MarkdownCheckboxProps {
  checked?: boolean;
}

export function MarkdownCheckbox({ checked = false }: MarkdownCheckboxProps) {
  const [isChecked, setIsChecked] = useState(checked);

  return (
    <Checkbox
      checked={isChecked}
      onCheckedChange={(value) => setIsChecked(value === true)}
      className="mt-0.5"
    />
  );
}
