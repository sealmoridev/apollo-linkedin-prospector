import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function Privacy() {
    return (
        <div className="container mx-auto max-w-4xl py-12 px-4">
            <Card className="border-none shadow-none md:border md:shadow-sm">
                <CardHeader className="text-center md:text-left">
                    <CardTitle className="text-3xl font-bold tracking-tight">Políticas de Privacidad</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none text-muted-foreground space-y-5">
                    <p className="font-medium text-foreground">Última actualización: {new Date().toLocaleDateString()}</p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">1. Información que Recopilamos</h2>
                    <p>Recopilamos y almacenamos los siguientes tipos de información cuando usted utiliza nuestra extensión de Chrome y/o nuestro panel de administración web:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>Información de la Cuenta:</strong> Direcciones de correo electrónico (vía Google OAuth), nombre e imagen de perfil para autenticar a los miembros y administradores.</li>
                            <li><strong>Tokens de Autorización:</strong> Tokens de acceso para la integración con Google Sheets proporcionados en el flujo OAuth.</li>
                            <li><strong>Metadatos y Registros (Logs):</strong> Direcciones capturadas e información sobre los usos de créditos (proveedores como Apollo, Prospeo, etc.) y envíos exitosos asociados al identificador de su empresa para auditoría interna del Tenant.</li>
                        </ul>
                    </p>
                    <p>Importante: La información de los prospectos extraídos por la extensión se envía directamente a la hoja de cálculo de Google definida, con un respaldo temporal de metadata en nuestro backend con propósitos de historizar la actividad de su propia empresa.</p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">2. Cómo Utilizamos la Información</h2>
                    <p>La información recopilada se utiliza de la siguiente manera:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Para autenticarlo y otorgarle acceso a su panel y extensión correspondiente.</li>
                            <li>Para realizar operaciones API permitidas, como exportar contactos capturados a sus hojas de Google Sheets.</li>
                            <li>Para contabilizar e informar el gasto de integraciones externas.</li>
                        </ul>
                    </p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">3. Uso Limitado (Google API Services User Data Policy)</h2>
                    <p>El uso y la transferencia a cualquier otra aplicación de la información recibida a través de las APIs de Google por parte de nuestra aplicación se adherirán estrictamente a la <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-primary hover:underline" target="_blank" rel="noreferrer">Política de datos de usuario de los servicios API de Google</a>, incluidos los requisitos de Uso Limitado (Limited Use Requirements).</p>
                    <p>No utilizamos los datos originados desde su cuenta de Google o de sus hojas de cálculo para servir anuncios ni los vendemos a terceros.</p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">4. Compartir y Divulgar Información</h2>
                    <p>Sus datos y configuraciones pertenecen a su cuenta de Empresa (Tenant). No transferimos ni compartimos ninguna información personal u organizacional con terceros distintos a los proveedores configurados y operados por usted (ej. APIs de enriquecimiento provistas en el panel).</p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">5. Almacenamiento y Seguridad</h2>
                    <p>Nuestra infraestructura prioriza la protección de sus datos:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Encriptación HTTPS obligatoria en el tránsito.</li>
                            <li>Técnicas de aislamiento lógico a nivel Tenant (cada empresa visualiza exclusivamente sus datos).</li>
                        </ul>
                    </p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">6. Retención de Datos y Derecho al Olvido</h2>
                    <p>Mantendremos los registros de actividad mientras su cuenta de empresa permanezca activa. Si desea que sus datos o su cuenta sean eliminados por completo del sistema, los administradores (SUPERADMIN) pueden eliminar las entidades de nuestro motor de datos de manera definitiva previa solicitud de soporte técnico.</p>
                </CardContent>
            </Card>
        </div>
    );
}
