import type { TextareaHTMLAttributes } from "react";

import { INPUT_CLASS } from "./TextInput";

export function TextArea({
  className = "",
  rows = 2,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      {...rest}
      className={`${INPUT_CLASS} resize-y leading-snug ${className}`}
    />
  );
}
