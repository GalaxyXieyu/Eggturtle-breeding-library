
/**
 * Formats a string by replacing placeholders with arguments
 * Example: formatString("Hello {0}", "World") => "Hello World"
 */
export const formatString = (format: string, ...args: unknown[]): string => {
  return format.replace(/{(\d+)}/g, (match, number) => {
    const value = args[Number(number)];
    return typeof value !== 'undefined' ? String(value) : match;
  });
};
