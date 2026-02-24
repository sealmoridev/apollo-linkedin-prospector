import dotenv from 'dotenv';
import { EnrichmentService } from './services/enrichment-service';

dotenv.config();

/**
 * Script simple para probar el enriquecimiento de un solo perfil
 * Uso: npx tsx src/test-single.ts <linkedin-url>
 */
async function main() {
  const apiKey = process.env.APOLLO_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: APOLLO_API_KEY no está configurada');
    process.exit(1);
  }

  // Obtener URL desde argumentos de línea de comandos
  const linkedinUrl = process.argv[2];

  if (!linkedinUrl) {
    console.error('❌ Error: Debes proporcionar una URL de LinkedIn');
    console.log('\nUso:');
    console.log('  npx tsx src/test-single.ts <linkedin-url>');
    console.log('\nEjemplo:');
    console.log('  npx tsx src/test-single.ts https://www.linkedin.com/in/williamhgates');
    process.exit(1);
  }

  const service = new EnrichmentService();

  try {
    console.log(`Buscando datos para: ${linkedinUrl}...`);
    console.log('---');

    const lead = await service.enrichProfile(apiKey, linkedinUrl);

    console.log('\n✅ ¡Perfil enriquecido exitosamente!\n');
    console.log('📊 Datos extraídos:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`👤 Nombre completo:    ${lead.fullName || 'No disponible'}`);
    console.log(`📧 Email:              ${lead.email || 'No disponible'}`);
    console.log(`📧 Email personal:     ${lead.personalEmail || 'No disponible'}`);
    console.log(`📞 Teléfono:           ${lead.phoneNumber || 'No disponible'}`);
    console.log(`💼 Título:             ${lead.title || 'No disponible'}`);
    console.log(`🏢 Empresa:            ${lead.company || 'No disponible'}`);
    console.log(`🌐 Dominio empresa:    ${lead.companyDomain || 'No disponible'}`);
    console.log(`🏭 Industria:          ${lead.industry || 'No disponible'}`);
    console.log(`📍 Ubicación:          ${lead.location || 'No disponible'}`);
    console.log(`🔗 LinkedIn:           ${lead.linkedinUrl}`);
    console.log(`🆔 Apollo ID:          ${lead.apolloId || 'No disponible'}`);
    console.log(`💳 Créditos usados:    ${lead.creditsConsumed}`);
    console.log(`⏰ Fecha:              ${lead.enrichedAt.toISOString()}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error al enriquecer perfil:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
