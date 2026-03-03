import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function Terms() {
    return (
        <div className="container mx-auto max-w-4xl py-12 px-4">
            <Card className="border-none shadow-none md:border md:shadow-sm">
                <CardHeader className="text-center md:text-left">
                    <CardTitle className="text-3xl font-bold tracking-tight">Términos y Condiciones</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none text-muted-foreground space-y-5">
                    <p className="font-medium text-foreground">Última actualización: {new Date().toLocaleDateString()}</p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">1. Aceptación de los Términos</h2>
                    <p>Al acceder o utilizar nuestra extensión de Chrome y panel de administración asociados a Mr. Prospect, usted acepta estar sujeto a estos términos y condiciones. Si no está de acuerdo con alguna parte de los términos, no podrá utilizar nuestro servicio.</p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">2. Descripción del Servicio</h2>
                    <p>Nuestro servicio incluye una extensión de navegador y un panel de administración web que permite a los equipos de ventas y SDRs capturar, enriquecer y organizar contactos de redes sociales profesionales para enviarlos a una hoja de cálculo (Google Sheets).</p>
                    <p>El responsable principal de la cuenta (el Administrador del Tenant o Empresa) es responsable de proveer sus propias credenciales de APIs de terceros si fuera necesario (ejemplo: Apollo, Prospeo, MillionVerifier) para habilitar las funcionalidades de enriquecimiento.</p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">3. Uso Permitido</h2>
                    <p>El servicio debe utilizarse estrictamente de acuerdo con:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Las políticas de la red social de donde se extraigan los datos (no proveemos scraping masivo o automatizado ciego, la herramienta asiste al uso manual del usuario).</li>
                            <li>Las leyes aplicables sobre privacidad de datos, antispam y comunicaciones electrónicas de su país/región.</li>
                        </ul>
                    </p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">4. Propiedad Intelectual e Información Confidencial</h2>
                    <p>El código fuente y diseño son propiedad de los desarrolladores originales. Los datos recolectados y guardados a través del servicio por cada perfil de usuario bajo una Empresa/Tenant, pertenecen exclusivamente a dicha organización. Nosotros actuamos únicamente como pasarela.</p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">5. Exención de Garantías y Limitación de Responsabilidad</h2>
                    <p>El software se proporciona "tal cual", sin garantías expresas o implícitas de ningún tipo. No garantizamos que el servicio será ininterrumpido o estará libre de errores. Bajo ninguna circunstancia seremos responsables de ningún reclamo, daño u otra responsabilidad derivada del uso de la extensión y el panel web.</p>

                    <h2 className="text-xl font-semibold text-foreground mt-8">6. Modificaciones de los Términos</h2>
                    <p>Nos reservamos el derecho de actualizar y modificar estos Términos y Condiciones en cualquier momento. Las condiciones más actuales se reflejarán publicando los cambios en esta página.</p>

                </CardContent>
            </Card>
        </div>
    );
}
