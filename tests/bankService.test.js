const { parseCamt054 } = require('../server/services/bankService');

const SAMPLE_CAMT054 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.04">
  <BkToCstmrDbtCdtNtfctn>
    <GrpHdr><MsgId>MSG-1</MsgId><CreDtTm>2026-04-30T08:00:00</CreDtTm></GrpHdr>
    <Ntfctn>
      <Id>NTF-1</Id>
      <Acct><Id><IBAN>CH4430000123456789012</IBAN></Id></Acct>
      <Ntry>
        <Amt Ccy="CHF">150.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-04-29</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <Refs><EndToEndId>NOTPROVIDED</EndToEndId></Refs>
            <RmtInf>
              <Strd><CdtrRefInf><Ref>210000000003139471430009017</Ref></CdtrRefInf></Strd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">99.50</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-04-29</Dt></BookgDt>
        <NtryDtls><TxDtls><Refs><EndToEndId>OUT</EndToEndId></Refs></TxDtls></NtryDtls>
      </Ntry>
    </Ntfctn>
  </BkToCstmrDbtCdtNtfctn>
</Document>`;

describe('bankService.parseCamt054', () => {
  test('extrahiert nur Gutschriften (CRDT)', async () => {
    const payments = await parseCamt054(SAMPLE_CAMT054);
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(150);
    expect(payments[0].currency).toBe('CHF');
    expect(payments[0].referenceNumber).toBe('210000000003139471430009017');
    expect(payments[0].date).toBe('2026-04-29');
  });

  test('liefert leeres Array bei ungueltigem XML', async () => {
    const result = await parseCamt054('<invalid></invalid>');
    expect(result).toEqual([]);
  });
});
