export default function Privacidad() {
  return (
    <div className="legal">
      <div className="brand" style={{ marginBottom: 24 }}><span className="brand-mark" />YouTube Manager</div>
      <h1>Política de privacidad</h1>
      <p className="muted">Última actualización: agosto de 2026</p>

      <h2>Qué es esta aplicación</h2>
      <p>
        YouTube Manager es una herramienta interna y privada para administrar los canales de YouTube de su propietario
        y de su equipo de trabajo. No está abierta al público ni se ofrece a terceros.
      </p>

      <h2>Qué datos usa</h2>
      <p>
        Al conectar un canal de YouTube mediante Google, la aplicación recibe un permiso de acceso (token OAuth) que
        se guarda en el servidor de la aplicación. Con ese permiso la aplicación puede: leer la lista de videos del
        canal, leer sus subtítulos y su información pública, y actualizar el título, la descripción y las etiquetas de
        los videos cuando el usuario lo solicita expresamente.
      </p>
      <p>
        La aplicación también consulta información pública de otros canales de YouTube (títulos, descripciones,
        etiquetas, miniaturas y estadísticas públicas) a través de la API oficial de YouTube, con fines de investigación
        de contenido.
      </p>

      <h2>Cómo se protegen y con quién se comparten</h2>
      <p>
        Los tokens de acceso nunca se envían al navegador ni a terceros: permanecen en el servidor y solo los usa la
        propia aplicación para las funciones descritas. No se venden ni se comparten datos con nadie. Los textos
        generados con inteligencia artificial se producen enviando transcripciones y metadatos a un proveedor de IA
        únicamente para generar ese texto.
      </p>

      <h2>Datos de Google y cumplimiento</h2>
      <p>
        El uso que hace esta aplicación de la información recibida de las API de Google se ajusta a la
        {" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Política de datos de usuario de los servicios de API de Google
        </a>, incluidos los requisitos de uso limitado. La aplicación usa los servicios de la API de YouTube y está
        sujeta a los{" "}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">Términos de servicio de YouTube</a>
        {" "}y a la{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Política de privacidad de Google</a>.
      </p>

      <h2>Cómo revocar el acceso</h2>
      <p>
        En cualquier momento se puede retirar el permiso concedido desde{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>
        , o desconectando el canal dentro de la aplicación, lo que elimina el token del servidor.
      </p>

      <h2>Contacto</h2>
      <p>Para cualquier consulta sobre esta política, escribe al correo de contacto indicado en la pantalla de consentimiento de Google.</p>

      <p style={{ marginTop: 32 }}><a href="/">← Volver a la aplicación</a></p>
    </div>
  );
}
