export function base64Encode(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64')
}
