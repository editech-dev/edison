import { renderToBuffer } from '@react-pdf/renderer';
import ProfessionalCvPdf from '@/app/components/CvPage/ProfessionalCvPdf';

export async function renderCvPdf(
  profile: any,
  lang: 'es' | 'en',
  photoBase64: string
): Promise<Buffer> {
  return renderToBuffer(
    <ProfessionalCvPdf profile={profile} lang={lang} photoBase64={photoBase64} />
  );
}
