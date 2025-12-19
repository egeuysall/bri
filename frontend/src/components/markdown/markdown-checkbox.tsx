'use client';

import { useState, useEffect } from 'react';
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
  // Start with the server-rendered state to avoid hydration mismatch
  const [isChecked, setIsChecked] = useState(checked);

  // Load saved state from storage on client side after initial render
  useEffect(() => {
    if (postId !== undefined && checkboxIndex !== undefined) {
      const savedState = getCheckboxState(postId, checkboxIndex, checked);
      if (savedState !== checked) {
        setIsChecked(savedState);
      }
    }
  }, [postId, checkboxIndex, checked]);

  const handleCheckedChange = (value: boolean | 'indeterminate') => {
    const newChecked = value === true;
    setIsChecked(newChecked);

    // Update storage if postId and checkboxIndex are provided
    if (postId !== undefined && checkboxIndex !== undefined) {
      updateCheckboxState(postId, checkboxIndex, newChecked, checked);
    }
  };

  return <Checkbox checked={isChecked} onCheckedChange={handleCheckedChange} className="mt-0.5" />;
}
