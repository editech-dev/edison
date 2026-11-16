
import { NextResponse } from 'next/server';
import { getPublicRepositories } from '@/app/utils/github';
import { buildSystemInstruction, toRepositoryContext } from '@/app/utils/agent-context';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // Ensure it's not cached at build time
// Leaves room for the background refresh scheduled with `after()`; the response itself never waits on it.
export const maxDuration = 60;

export async function GET() {
  try {
    // 1. Repositorios desde la caché (nunca espera a GitHub ni a Gemini)
    const rawGithubData = await getPublicRepositories(true);

    // 2. Leer el perfil local (con soporte de Redis y fallback)
    const { getCvProfile } = await import('@/app/utils/redis');
    const profileData = await getCvProfile();

    // 3. Leer el prompt XML
    const xmlPath = path.join(process.cwd(), 'src/app/utils/expert_persona.xml');
    const xmlTemplate = fs.readFileSync(xmlPath, 'utf8');

    // 4. Inyectar un contexto compacto (descripciones + extracto del README por repo)
    const systemInstruction = buildSystemInstruction(xmlTemplate, profileData, rawGithubData);

    return NextResponse.json({
      systemInstruction,
      context: {
        github: rawGithubData.map(toRepositoryContext),
        profile: profileData
      }
    });
  } catch (error) {
    console.error('Error generando contexto del agente:', error);
    return NextResponse.json(
      { error: 'Error interno generando contexto' },
      { status: 500 }
    );
  }
}
