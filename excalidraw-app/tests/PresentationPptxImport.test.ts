import { importPptxPresentation } from "../presentation/pptxImport";

const encoder = new TextEncoder();

const concat = (chunks: Uint8Array[]) => {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

const uint16 = (value: number) =>
  Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);

const uint32 = (value: number) =>
  Uint8Array.from([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pptx = (files: Record<string, string>) => {
  const localFiles: Uint8Array[] = [];
  const centralFiles: Uint8Array[] = [];
  let offset = 0;

  for (const [name, contents] of Object.entries(files)) {
    const fileName = encoder.encode(name);
    const data = encoder.encode(contents);
    const checksum = crc32(data);
    const localHeader = concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(data.length),
      uint32(data.length),
      uint16(fileName.length),
      uint16(0),
      fileName,
    ]);
    localFiles.push(localHeader, data);
    centralFiles.push(
      concat([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(checksum),
        uint32(data.length),
        uint32(data.length),
        uint16(fileName.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        fileName,
      ]),
    );
    offset += localHeader.length + data.length;
  }
  const centralDirectory = concat(centralFiles);
  const archiveBytes = concat([
    ...localFiles,
    centralDirectory,
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(centralFiles.length),
    uint16(centralFiles.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
  ]);
  return new File([archiveBytes.buffer], "source.pptx", {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
};

const presentationXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="257" r:id="rId7"/><p:sldId id="256" r:id="rId3"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500"/>
</p:presentation>`;

const presentationRelationships = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide-one.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide-two.xml"/>
</Relationships>`;

const slide = (
  name: string,
  text: string,
) => `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="2743200" cy="914400"/></a:xfrm><a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="4DABF7"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="1C7ED6"/></a:solidFill></a:ln></p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="2400"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:cxnSp>
      <p:nvCxnSpPr><p:cNvPr id="3" name="Flow"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
      <p:spPr><a:xfrm><a:off x="914400" y="2286000"/><a:ext cx="1828800" cy="914400"/></a:xfrm><a:prstGeom prst="line"/><a:ln w="19050"><a:solidFill><a:srgbClr val="37B24D"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr>
    </p:cxnSp>
    <p:graphicFrame>
      <p:nvGraphicFramePr><p:cNvPr id="4" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
      <p:xfrm><a:off x="4572000" y="914400"/><a:ext cx="3657600" cy="914400"/></p:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>
        <a:tblGrid><a:gridCol w="1828800"/><a:gridCol w="1828800"/></a:tblGrid>
        <a:tr h="914400"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Label</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="F8F9FA"/></a:solidFill></a:tcPr></a:tc><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Value</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr>
      </a:tbl></a:graphicData></a:graphic>
    </p:graphicFrame>
  </p:spTree></p:cSld>
</p:sld>`;

describe("PPTX presentation import", () => {
  it("preserves declared slide order and converts slide content into native elements", async () => {
    const file = pptx({
      "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>`,
      "ppt/presentation.xml": presentationXml,
      "ppt/_rels/presentation.xml.rels": presentationRelationships,
      "ppt/slides/slide-one.xml": slide("First", "First slide"),
      "ppt/slides/slide-two.xml": slide("Second", "Second slide"),
    });
    const result = await importPptxPresentation(file, {
      origin: { x: 100, y: 200 },
    });

    const frames = result.elements.filter(
      (element) => element.type === "frame",
    );
    expect(frames).toHaveLength(2);
    expect(frames.map((frame) => frame.x)).toEqual([100, 1220]);

    const texts = result.elements
      .filter((element) => element.type === "text")
      .map((element) => element.text);
    expect(texts).toEqual(
      expect.arrayContaining(["Second slide", "First slide", "Label", "Value"]),
    );

    expect(
      result.elements.some(
        (element) =>
          element.type === "rectangle" && element.backgroundColor === "#4dabf7",
      ),
    ).toBe(true);
    expect(result.elements.some((element) => element.type === "arrow")).toBe(
      true,
    );
    expect(result.unsupported).toEqual({});
  });

  it("rejects a non-PPTX file before touching the canvas", async () => {
    await expect(
      importPptxPresentation(new File(["not a pptx"], "source.pdf"), {
        origin: { x: 0, y: 0 },
      }),
    ).rejects.toThrow(".pptx");
  });
});
