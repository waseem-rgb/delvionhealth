// Full ASTM E1394-97 parser
// Control chars: STX=0x02, ETX=0x03, ENQ=0x05, ACK=0x06, NAK=0x15, EOT=0x04
// Record types: H (header), P (patient), O (order), R (result), L (terminator)
// Returns AstmMessage interface

export interface AstmResult {
  testCode: string;       // from R record field 3 (e.g. "^^HGB")
  value: string;          // from R record field 4
  unit: string;           // from R record field 5
  referenceRange: string; // from R record field 6
  flags: string;          // from R record field 7 (N=normal, L=low, H=high, LL, HH)
}

export interface AstmMessage {
  messageId: string;
  patientId: string;   // P record field 4 (patient ID)
  orderId: string;     // O record field 4 (order ID)
  results: AstmResult[];
  raw: string;
}

export class AstmParser {
  readonly ENQ = 0x05;
  readonly ACK = 0x06;
  readonly NAK = 0x15;
  readonly EOT = 0x04;
  readonly STX = 0x02;
  readonly ETX = 0x03;
  readonly CR = 0x0d;

  isEnq(buf: Buffer): boolean { return buf.length === 1 && buf[0] === this.ENQ; }
  isEot(buf: Buffer): boolean { return buf.length === 1 && buf[0] === this.EOT; }
  ackBuffer(): Buffer { return Buffer.from([this.ACK]); }
  nakBuffer(): Buffer { return Buffer.from([this.NAK]); }

  parse(buf: Buffer): AstmMessage | null {
    // Strip STX/ETX and checksum; split by CR into records
    let text = buf.toString('ascii');
    // Remove control chars, keep printable + CR
    text = text.replace(/[\x02\x03]/g, '');
    const records = text.split(/\r|\n/).filter(r => r.trim().length > 0);

    const msg: AstmMessage = {
      messageId: Date.now().toString(),
      patientId: '',
      orderId: '',
      results: [],
      raw: buf.toString('ascii'),
    };

    for (const record of records) {
      // Strip leading frame number (1-7) if present
      const clean = record.replace(/^\d/, '');
      const fields = clean.split('|');
      const type = fields[0];

      if (type === 'H') {
        msg.messageId = fields[10] || msg.messageId; // Message ID in H record
      } else if (type === 'P') {
        msg.patientId = fields[3] || fields[2] || ''; // Patient ID
      } else if (type === 'O') {
        msg.orderId = fields[3] || ''; // Specimen ID / order ref
      } else if (type === 'R') {
        // R|1|^^^HGB|12.5|g/dL|11.5-16.5|N
        const testCode = (fields[2] || '').replace(/\^+/g, '').trim();
        msg.results.push({
          testCode,
          value: fields[3] || '',
          unit: fields[4] || '',
          referenceRange: fields[5] || '',
          flags: fields[6] || 'N',
        });
      }
    }

    return msg.results.length > 0 ? msg : null;
  }
}
