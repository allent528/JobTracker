/** Never echoes the database message: it can quote row values. */
export function writeErrorMessage(error: { code?: string } | null | undefined): string {
  switch (error?.code) {
    case "23514": // check_violation
    case "22001": // string_data_right_truncation
    case "22P02": // invalid_text_representation
    case "22003": // numeric_value_out_of_range
      return "Some values aren't allowed. Check the form and try again.";
    case "23503": // foreign_key_violation
    case "42501": // insufficient_privilege / RLS denial
      return "You can't make that change.";
    default:
      return "We couldn't save your changes. Try again.";
  }
}
