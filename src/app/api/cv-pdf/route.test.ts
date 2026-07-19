import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks (hoisted by Vitest) ──
vi.mock('@/app/utils/redis', () => ({
  getCvProfile: vi.fn(),
}));

vi.mock('./render', () => ({
  renderCvPdf: vi.fn(),
}));

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn() },
}));

vi.mock('path', () => ({
  default: { join: vi.fn((...args: string[]) => args.join('/')) },
}));

// ── Import after mocks ──
import { GET } from './route';
import { getCvProfile } from '@/app/utils/redis';
import { renderCvPdf } from './render';

// fs is now mocked, we can import it
import fs from 'fs';

const mockProfile = {
  personal: {
    name: 'Edison Esteban Isaza López',
    title_es: 'Full-Stack Developer',
    title_en: 'Full-Stack Developer',
    contact: {
      email: 'edisonisaza@gmail.com',
      phone: '+57 322 375 2131',
      linkedin: 'https://www.linkedin.com/in/edison-isaza',
      github: 'https://github.com/editech-dev',
      website: 'https://editech.dev',
      location_es: 'Medellín, Colombia',
      location_en: 'Medellin, Colombia',
    },
    summary_es: 'Resumen en español.',
    summary_en: 'Summary in English.',
  },
  experience: [
    {
      company: 'Grupo Unión',
      role_es: 'Desarrollador Full-Stack',
      role_en: 'Full-Stack Developer',
      dates_es: 'Nov 2021 – Presente',
      dates_en: 'Nov 2021 – Present',
      location_es: 'Medellín, Colombia',
      location_en: 'Medellin, Colombia',
      details_es: ['Detail 1'],
      details_en: ['Detail 1 en'],
    },
  ],
  education: [
    {
      institution: 'Holberton School',
      degree_es: 'Software Engineer',
      degree_en: 'Software Engineer',
      year: '2020-2021',
    },
  ],
  skills: {
    categories_es: [{ name: 'Data Science', items: ['Python', 'ML'] }],
    categories_en: [{ name: 'Data Science', items: ['Python', 'ML'] }],
  },
  certifications_es: ['Cert 1'],
  certifications_en: ['Cert 1 en'],
  presentations_es: [],
  presentations_en: [],
  soft_skills_es: ['Skill 1'],
  soft_skills_en: ['Skill 1 en'],
  languages_es: [{ language: 'Español', level: 'Nativo' }],
  languages_en: [{ language: 'Spanish', level: 'Native' }],
};

const fakePdfBuffer = Buffer.from('fake-pdf-content');

describe('GET /api/cv-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCvProfile).mockResolvedValue(mockProfile);
    vi.mocked(renderCvPdf).mockResolvedValue(fakePdfBuffer);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-photo-data'));
  });

  it('returns a PDF with application/pdf content-type for lang=es', async () => {
    const req = new NextRequest('http://localhost:3000/api/cv-pdf?lang=es');
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('Edison_Isaza_CV.pdf');
    expect(getCvProfile).toHaveBeenCalledTimes(1);
    expect(renderCvPdf).toHaveBeenCalledWith(mockProfile, 'es', expect.any(String));
  });

  it('returns a PDF with application/pdf content-type for lang=en', async () => {
    const req = new NextRequest('http://localhost:3000/api/cv-pdf?lang=en');
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('Edison_Isaza_Resume.pdf');
    expect(renderCvPdf).toHaveBeenCalledWith(mockProfile, 'en', expect.any(String));
  });

  it('defaults to Spanish when no lang param is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/cv-pdf');
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toContain('Edison_Isaza_CV.pdf');
    expect(renderCvPdf).toHaveBeenCalledWith(mockProfile, 'es', expect.any(String));
  });

  it('has Content-Disposition: attachment header', async () => {
    const req = new NextRequest('http://localhost:3000/api/cv-pdf?lang=es');
    const response = await GET(req);

    expect(response.headers.get('Content-Disposition')).toMatch(
      /^attachment;\s*filename="Edison_Isaza_CV\.pdf"$/,
    );
  });

  it('has Content-Length header matching the buffer length', async () => {
    const req = new NextRequest('http://localhost:3000/api/cv-pdf?lang=es');
    const response = await GET(req);

    expect(response.headers.get('Content-Length')).toBe(
      String(fakePdfBuffer.length),
    );
  });

  it('returns 500 when getCvProfile returns null', async () => {
    vi.mocked(getCvProfile).mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/cv-pdf');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'CV profile data not found' });
  });

  it('returns 500 when renderCvPdf throws', async () => {
    vi.mocked(renderCvPdf).mockRejectedValue(new Error('PDF render failed'));

    const req = new NextRequest('http://localhost:3000/api/cv-pdf');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to generate PDF' });
  });

  it('reads the photo file from the public directory', async () => {
    const req = new NextRequest('http://localhost:3000/api/cv-pdf?lang=es');
    await GET(req);

    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(fs.readFileSync).mock.calls[0][0] as string;
    expect(callArg).toContain('Edison_Isaza_photo.png');
  });

  it('includes a base64 data URI for the photo', async () => {
    const req = new NextRequest('http://localhost:3000/api/cv-pdf?lang=es');
    await GET(req);

    const photoBase64Arg = vi.mocked(renderCvPdf).mock.calls[0][2];
    expect(photoBase64Arg).toMatch(/^data:image\/png;base64,/);
  });
});
