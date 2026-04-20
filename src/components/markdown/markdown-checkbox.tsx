'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { getCheckboxState, updateCheckboxState } from './checkbox-storage';

interface MarkdownCheckboxProps {
  checked?: boolean;
  postId?: string;
  checkboxIndex?: number;
}

export function MarkdownCheckbox({
  checked = false,
  postId,
  checkboxIndex = 0,
}: MarkdownCheckboxProps) {
  const [isChecked, setIsChecked] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return checked;
    }

    if (postId === undefined || checkboxIndex === undefined) {
      return checked;
    }

    return getCheckboxState(postId, checkboxIndex, checked);
  });

  const handleCheckedChange = (value: boolean) => {
    const newChecked = value;
    setIsChecked(newChecked);

    // Update storage if postId and checkboxIndex are provided
    if (postId !== undefined && checkboxIndex !== undefined) {
      updateCheckboxState(postId, checkboxIndex, newChecked, checked);
    }
  };

  return (
    <Checkbox
      checked={isChecked}
      onCheckedChange={handleCheckedChange}
      className="mt-0.5 size-4 cursor-pointer rounded-md border-neutral-500 data-checked:border-neutral-200 data-checked:bg-neutral-200 data-checked:text-neutral-950"
    />
  );
}
