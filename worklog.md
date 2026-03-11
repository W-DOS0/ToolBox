---
Task ID: 2
Agent: Main Agent
Task: Simplify UI to 3-step workflow (Input → Edit → Export)

Work Log:
- Created unified ToolWorkflow component with 3 steps
- Built file type detection system in tools/utils/fileDetection.ts
- Implemented input modes: File upload, Text input, URL input
- Created dynamic edit operations based on detected file type
- Built export format selection for each file type
- Removed old fileDetector.ts that had invalid lucide-react imports
- Updated main page to use new unified workflow
- Added image processing: compress, resize, rotate
- Added text/JSON processing: format, minify, transform
- Added URL processing: QR code generation

Stage Summary:
- Single-page 3-step workflow implemented
- Supports: Image, PDF, JSON, CSV, XML, HTML, CSS, JavaScript, Markdown, Text, URL
- Dynamic edit options appear based on detected file type
- Export formats adapt to file type
- Clean, minimalist UI with step indicator
- Mobile-first responsive design
