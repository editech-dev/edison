
import { NextResponse } from 'next/server';
import { getPublicRepositories } from '@/app/utils/github';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // Ensure it's not cached at build time

export async function GET() {
  try {
    // 1. Obtener datos de GitHub
    const rawGithubData = await getPublicRepositories();
    
    // Inyectar extractos del README para enriquecer el contexto neuronal
    const { getReadmeContent } = await import('@/app/utils/github');
    const githubData = await Promise.all(rawGithubData.map(async (repo) => {
        const readme = await getReadmeContent(repo.name);
        // Truncate to first 400 chars to avoid prompt bloat but keep context
        const readmePreview = readme ? readme.substring(0, 400).replace(/\n/g, ' ') + '...' : 'No description available';
        return {
            ...repo,
            readme_preview: readmePreview
        };
    }));

    // 2. Leer el perfil local
    const profilePath = path.join(process.cwd(), 'src/data/profile.json');
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

    // 3. Leer el prompt XML
    const xmlPath = path.join(process.cwd(), 'src/app/utils/expert_persona.xml');
    let xmlTemplate = fs.readFileSync(xmlPath, 'utf8');

    // 4. Inyectar contexto en el XML
    const systemInstruction = xmlTemplate
      .replace('{{PROFILE_CONTEXT}}', JSON.stringify(profileData, null, 2))
      .replace('{{GITHUB_CONTEXT}}', JSON.stringify(githubData, null, 2));

    return NextResponse.json({
      systemInstruction,
      context: {
        github: githubData,
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
