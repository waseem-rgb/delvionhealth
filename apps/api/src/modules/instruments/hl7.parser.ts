// HL7 v2.x MLLP parser
// MLLP framing: VT (0x0B) + data + FS (0x1C) + CR (0x0D)
// Message types: ORU_R01 (results), ORM_O01 (orders)
// Segments: MSH, PID, OBR, OBX

export interface Hl7Result {
  testCode: string;       // OBX-3 identifier
  value: string;          // OBX-5
  unit: string;           // OBX-6
  referenceRange: string; // OBX-7
  flags: string;          // OBX-8 (N, L, H, LL, HH)
}

export interface Hl7Message {
  messageId: string;  // MSH-10
  patientId: string;  // PID-3 or PID-2
  orderId: string;    // OBR-3 or OBR-2
  results: Hl7Result[];
  raw: string;
}

export class Hl7Parser {
  readonly VT = 0x0b;
  readonly FS = 0x1c;
  readonly CR = 0x0d;

  /** Wrap data in MLLP framing */
  frame(data: string): Buffer {
    const inner = Buffer.from(data, 'ascii');
    return Buffer.concat([
      Buffer.from([this.VT]),
      inner,
      Buffer.from([this.FS, this.CR]),
    ]);
  }

  /** Generate ACK message */
  ack(messageId: string): Buffer {
    const now = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const ackMsg = `MSH|^~\\&|DELViON|||${now}||ACK|${messageId}|P|2.5\rMSA|AA|${messageId}\r`;
    return this.frame(ackMsg);
  }

  isStartBlock(buf: Buffer): boolean {
    return buf.length > 0 && buf[0] === this.VT;
  }

  /** Parse MLLP-framed HL7 message */
  parse(data: string | Buffer): Hl7Message | null {
    const rawStr: string = Buffer.isBuffer(data) ? data.toString('ascii') : data;
    // Strip MLLP framing
    const text = rawStr.replace(/\x0b/g, '').replace(/\x1c\x0d/g, '').trim();

    const segments = text.split(/[\r\n]+/).filter((s: string) => s.length > 0);

    const msg: Hl7Message = {
      messageId: Date.now().toString(),
      patientId: '',
      orderId: '',
      results: [],
      raw: text,
    };

    for (const seg of segments) {
      const fields = seg.split('|');
      const segType = fields[0];

      if (segType === 'MSH') {
        msg.messageId = fields[9] ?? msg.messageId;
      } else if (segType === 'PID') {
        // PID-3 is patient identifier list
        const pid3 = fields[3] ?? fields[2] ?? '';
        msg.patientId = pid3.split('^')[0] ?? '';
      } else if (segType === 'OBR') {
        // OBR-3 is filler order number
        const obr3 = fields[3] ?? fields[2] ?? '';
        msg.orderId = obr3.split('^')[0] ?? '';
      } else if (segType === 'OBX') {
        // OBX|1|NM|718-7^Hemoglobin^LN||12.5|g/dL|11.5-16.5|N
        const codeField = fields[3] ?? '';
        const testCode = codeField.split('^')[0] ?? '';
        msg.results.push({
          testCode,
          value: fields[5] ?? '',
          unit: fields[6] ?? '',
          referenceRange: fields[7] ?? '',
          flags: fields[8] ?? 'N',
        });
      }
    }

    return msg.results.length > 0 ? msg : null;
  }
}
