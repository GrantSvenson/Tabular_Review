

import { API_URL, readApiResponse } from './api.ts';

export const processDocumentToMarkdown = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // Send to local backend running Docling
    const response = await fetch(`${API_URL}/convert`, {
      method: 'POST',
      body: formData,
    });

    const data = await readApiResponse(response);
    return data.markdown || "";

  } catch (error) {
    console.error("Document Conversion failed:", error);
    throw new Error(`Failed to convert ${file.name}. Is the backend server running?`);
  }
};

