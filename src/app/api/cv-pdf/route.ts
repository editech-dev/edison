import { NextRequest, NextResponse } from 'next/server';
import { getCvProfile } from '@/app/utils/redis';
import { renderCvPdf } from './render';
import fs from 'fs';
import path from 'path';

function getPhotoBase64(): string {
  const photoPath = path.join(
    process.cwd(),
    'public',
    'Edison_Isaza_photo.png'
  );
  const buffer = fs.readFileSync(photoPath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lang = searchParams.get('lang') === 'en' ? 'en' : 'es';

    const profile = await getCvProfile();

    if (!profile) {
      return NextResponse.json(
        { error: 'CV profile data not found' },
        { status: 500 }
      );
    }

    const photoBase64 = getPhotoBase64();

    const pdfBuffer = await renderCvPdf(profile, lang, photoBase64);

    const filename =
      lang === 'en'
        ? 'Edison_Isaza_Resume.pdf'
        : 'Edison_Isaza_CV.pdf';

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating CV PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
