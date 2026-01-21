/**
 * XML Parsing Utilities
 *
 * Utilities for extracting data from SOAP/XML responses from the DATS API.
 */

/**
 * Extract the text content of an XML tag
 * Handles tags with attributes: <Tag attr="value">content</Tag>
 *
 * @param xml - XML string to search
 * @param tag - Tag name to find
 * @returns Text content of the first match, or empty string if not found
 */
export function extractXml(xml: string, tag: string): string {
  // [^>]* allows for XML attributes like <Tag attr="value">
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return match ? match[1].trim() : '';
}

/**
 * Extract all occurrences of an XML tag
 * Note: This simpler version doesn't handle attributes on the tag
 *
 * @param xml - XML string to search
 * @param tag - Tag name to find
 * @returns Array of text contents for all matches
 */
export function extractAllXml(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g');
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

/**
 * Extract XML tag with attributes (more permissive matching)
 * Handles tags like: <TtsText cattr="required">content</TtsText>
 *
 * @param xml - XML string to search
 * @param tag - Tag name to find
 * @returns Text content of the first match, or empty string if not found
 */
export function extractXmlWithAttributes(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return match ? match[1].trim() : '';
}

/**
 * Extract a block of XML between opening and closing tags
 * Useful for extracting nested XML structures
 *
 * @param xml - XML string to search
 * @param tag - Tag name to find
 * @returns Inner XML content (including nested tags), or empty string if not found
 *
 * @example
 * extractXmlBlock('<Person><Name>John</Name><Age>30</Age></Person>', 'Person')
 * // Returns: '<Name>John</Name><Age>30</Age>'
 */
export function extractXmlBlock(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extract all blocks of a specific XML tag (including nested content)
 * Useful for extracting multiple records
 *
 * @param xml - XML string to search
 * @param tag - Tag name to find
 * @returns Array of inner XML content for all matches
 *
 * @example
 * extractAllXmlBlocks(xmlString, 'Trip')
 * // Returns array of trip XML blocks
 */
export function extractAllXmlBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

/**
 * Check if XML contains a specific response wrapper
 * Useful for validating response types
 *
 * @param xml - XML string to check
 * @param responseName - Response tag name (e.g., 'PassGetClientInfoResponse')
 * @returns true if response tag is found
 */
export function hasXmlResponse(xml: string, responseName: string): boolean {
  return xml.includes(responseName);
}

/**
 * Parse XML attributes from a tag
 * Example: <Trip id="123" status="active"> -> {id: "123", status: "active"}
 *
 * @param xml - XML string containing the tag
 * @param tag - Tag name to parse attributes from
 * @returns Object with attribute key-value pairs
 */
export function parseXmlAttributes(xml: string, tag: string): Record<string, string> {
  const match = xml.match(new RegExp(`<${tag}([^>]*)>`));
  if (!match) return {};

  const attrsString = match[1];
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  let attrMatch;

  while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
    attrs[attrMatch[1]] = attrMatch[2];
  }

  return attrs;
}

/**
 * Count occurrences of a specific XML tag
 * Useful for validation or debugging
 *
 * @param xml - XML string to search
 * @param tag - Tag name to count
 * @returns Number of occurrences
 */
export function countXmlTags(xml: string, tag: string): number {
  const regex = new RegExp(`<${tag}[^>]*>`, 'g');
  const matches = xml.match(regex);
  return matches ? matches.length : 0;
}
