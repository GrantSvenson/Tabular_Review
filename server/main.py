from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openrouter import router as openrouter_router
from docling.document_converter import DocumentConverter
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
from docling.datamodel.base_models import InputFormat
from docling.document_converter import PdfFormatOption
import tempfile
import os
import shutil
import platform

app = FastAPI()
app.include_router(openrouter_router)

# Configure CORS
# In production, replace with specific origins
origins = [
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (3000, 3001, 5173)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize converter with GPU acceleration if available
# Use MPS (Metal Performance Shaders) on Apple Silicon Macs
def create_converter():
    if platform.system() == "Darwin":  # macOS
        print("Detected macOS - enabling MPS (Metal) GPU acceleration")
        accelerator_options = AcceleratorOptions(
            device=AcceleratorDevice.MPS,
            num_threads=4
        )
    else:
        print("Running on CPU (MPS not available)")
        accelerator_options = AcceleratorOptions(
            device=AcceleratorDevice.AUTO,
            num_threads=4
        )
    
    # Configure PDF pipeline with accelerator options
    pdf_pipeline_options = PdfPipelineOptions()
    pdf_pipeline_options.accelerator_options = accelerator_options
    
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_pipeline_options)
        }
    )

converter = create_converter()

@app.post("/convert")
def convert_document(file: UploadFile = File(...)):
    try:
        # Create a temporary file to save the uploaded content
        # Docling needs a file path
        suffix = os.path.splitext(file.filename)[1]
        if not suffix:
            suffix = ""
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        try:
            # Convert the document
            result = converter.convert(tmp_path)
            # Export to markdown
            markdown_content = result.document.export_to_markdown()
            return {"markdown": markdown_content}
        finally:
            # Clean up the temporary file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    except Exception as e:
        print(f"Error converting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=8000)
