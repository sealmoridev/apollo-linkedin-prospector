import dotenv from 'dotenv';
import { EnrichmentService } from './services/enrichment-service';

dotenv.config();

/**
 * Script para probar el enriquecimiento batch de múltiples perfiles
 * Uso: npx tsx src/test-batch.ts <url1> <url2> <url3> ...
 */
async function main() {
  const apiKey = process.env.APOLLO_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: APOLLO_API_KEY no está configurada');
    process.exit(1);
  }

  // Obtener URLs desde argumentos de línea de comandos
  const linkedinUrls = process.argv.slice(2);

  if (linkedinUrls.length === 0) {
    console.error('❌ Error: Debes proporcionar al menos una URL de LinkedIn');
    console.log('\nUso:');
    console.log('  npx tsx src/test-batch.ts <url1> <url2> <url3> ...');
    console.log('\nEjemplo:');
    console.log('  npx tsx src/test-batch.ts \\');
    console.log('    https://www.linkedin.com/in/williamhgates \\');
    console.log('    https://www.linkedin.com/in/satyanadella');
    process.exit(1);
  }

  const service = new EnrichmentService();

  try {
    console.log(`Iniciando enriquecimiento batch de ${linkedinUrls.length} perfiles...`);
    console.log('Urls:', linkedinUrls);
    console.log('---');

    const result = await service.enrichProfiles(apiKey, linkedinUrls);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DEL BATCH');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ Exitosos:           ${result.successful.length}`);
    console.log(`❌ Fallidos:           ${result.failed.length}`);
    console.log(`💳 Créditos totales:   ${result.totalCreditsConsumed}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (result.successful.length > 0) {
      console.log('✅ PERFILES ENRIQUECIDOS EXITOSAMENTE:\n');
      result.successful.forEach((lead, i) => {
        console.log(`${i + 1}. ${lead.fullName || 'Sin nombre'}`);
        console.log(`   📧 ${lead.email || 'Sin email'}`);
        console.log(`   💼 ${lead.title || 'Sin título'} @ ${lead.company || 'Sin empresa'}`);
        console.log(`   📍 ${lead.location || 'Sin ubicación'}`);
        console.log(`   🔗 ${lead.linkedinUrl}`);
        console.log('');
      });
    }

    if (result.failed.length > 0) {
      console.log('❌ PERFILES QUE FALLARON:\n');
      result.failed.forEach((fail, i) => {
        console.log(`${i + 1}. ${fail.linkedinUrl}`);
        console.log(`   Error: ${fail.error}`);
        console.log(`   Código: ${fail.errorCode}`);
        console.log('');
      });
    }

    console.log('✅ Proceso completado\n');

  } catch (error) {
    console.error('\n❌ Error en el proceso batch:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
