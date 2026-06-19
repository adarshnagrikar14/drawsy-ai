# Mermaid To Excalidraw

Package: `@excalidraw/mermaid-to-excalidraw`

Local dependency:

- `packages/excalidraw/package.json` uses `@excalidraw/mermaid-to-excalidraw: 2.2.2`

## How It Works

Docs describe a two-step process:

1. `parseMermaidToExcalidraw(mermaidSyntax)` returns Excalidraw skeleton elements.
2. `convertToExcalidrawElements(elements)` converts skeletons to full Excalidraw elements.

Reason:

Docs say this split exists because `@excalidraw/excalidraw` has UMD build constraints and cannot yet import only `convertToExcalidrawElements` as a tree-shakeable ESM util.

## Supported

Flowcharts are the primary supported diagram type.

Supported flowchart pieces:

- rectangles
- circles
- diamonds
- arrows
- subgraphs

## Fallbacks

Unsupported flowchart shapes fall back to rectangle:

- subroutine
- cylindrical
- asymmetric
- hexagon
- parallelogram
- trapezoid

Other limitations:

- Markdown strings fall back to regular text
- FontAwesome falls back to text
- cross arrow head falls back to bar arrow head
- unsupported diagram types render as image in Excalidraw

## Parser Internals

Docs describe:

- render Mermaid to SVG
- parse Mermaid syntax
- parse diagram into vertices/edges/subgraphs
- compute positions/dimensions from SVG
- convert output into Excalidraw skeleton

## Adding New Diagram Types

Docs say to:

1. update supported diagram types
2. create parser file in `src/parser`
3. write diagram parser
4. write skeleton converter
5. update playground

## AI Lead

This is an underrated non-LLM diagram generation path:

- LLM generates Mermaid
- `@excalidraw/mermaid-to-excalidraw` converts it to editable Excalidraw
- `convertToExcalidrawElements` makes real canvas elements

This avoids image-only AI diagram output and keeps diagrams editable.

Limitation:

Only flowcharts become rich editable shapes. Many other Mermaid diagram types become image fallbacks.
