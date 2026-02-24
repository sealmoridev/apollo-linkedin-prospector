import dotenv from 'dotenv';
import { EnrichmentService } from './services/enrichment-service';
import { WebhookServer } from './services/webhook-server';

dotenv.config();

/**
 * Script para probar el enriquecimiento CON números de teléfono
 * Requiere un servidor webhook activo
 * 
 * Uso: npx tsx src/test-with-phone.ts <linkedin-url>
 */
async function main() {
  const apiKey = process.env.APOLLO_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: APOLLO_API_KEY no está configurada');
    process.exit(1);
  }

  // Obtener URL desde argumentos
  const linkedinUrl = process.argv[2];

  if (!linkedinUrl) {
    console.error('❌ Error: Debes proporcionar una URL de LinkedIn');
    console.log('\nUso:');
    console.log('  npx tsx src/test-with-phone.ts <linkedin-url>');
    console.log('\nEjemplo:');
    console.log('  npx tsx src/test-with-phone.ts https://www.linkedin.com/in/williamhgates');
    console.log('\n⚠️  IMPORTANTE:');
    console.log('  - Este script inicia un servidor webhook en el puerto 3000');
    console.log('  - Para producción, necesitas exponer este servidor públicamente');
    console.log('  - Puedes usar ngrok, localtunnel, o desplegar en un servidor');
    process.exit(1);
  }

  // Obtener configuración del webhook
  const webhookPort = parseInt(process.env.WEBHOOK_PORT || '3000');
  const publicWebhookUrl = process.env.PUBLIC_WEBHOOK_URL;

  console.log('🚀 Apollo LinkedIn Prospector - Con Números de Teléfono\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Iniciar servidor webhook
  const webhookServer = new WebhookServer(webhookPort, publicWebhookUrl);

  try {
    await webhookServer.start();

    // Crear servicio de enriquecimiento con webhook
    const service = new EnrichmentService(webhookServer);

    console.log(`📋 Enriqueciendo perfil: ${linkedinUrl}\n`);
    console.log('⏳ Esperando respuesta de Apollo (esto puede tomar 30-60 segundos)...\n');

    // Enriquecer perfil CON teléfono
    const lead = await service.enrichProfile(apiKey, linkedinUrl, undefined, true);

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

    if (lead.phoneNumber) {
      console.log('✅ ¡Número de teléfono obtenido exitosamente!\n');
    } else {
      console.log('⚠️  No se pudo obtener el número de teléfono');
      console.log('   Posibles razones:');
      console.log('   - El perfil no tiene teléfono en la base de datos de Apollo');
      console.log('   - El webhook no es accesible públicamente');
      console.log('   - Apollo no pudo enviar los datos al webhook\n');
    }

  } catch (error) {
    console.error('\n❌ Error al enriquecer perfil:');
    console.error(error instanceof Error ? error.message : error);
  } finally {
    // Detener servidor webhook
    console.log('🛑 Deteniendo servidor webhook...');
    await webhookServer.stop();
    console.log('✅ Proceso completado\n');
    process.exit(0);
  }
}

main();
