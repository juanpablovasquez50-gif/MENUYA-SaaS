import * as React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, ShieldCheck, FileText, LockKeyhole } from 'lucide-react';
import './LegalPages.css';

type Props = { document: 'privacy' | 'terms' };

export default function LegalPages({ document }: Props) {
  const isPrivacy = document === 'privacy';
  return <main className="legal-shell">
    <header className="legal-nav">
      <Link href="/" className="legal-brand">CLICK<span>OK</span></Link>
      <Link href="/" className="legal-back"><ArrowLeft size={16}/> Volver a CLICKOK</Link>
    </header>
    <article className="legal-document">
      <div className="legal-kicker">{isPrivacy ? <ShieldCheck size={17}/> : <FileText size={17}/>} DOCUMENTOS LEGALES · CLICKOK / ATOM LABS</div>
      <h1>{isPrivacy ? 'Política de tratamiento de datos personales y privacidad' : 'Términos y condiciones de uso'}</h1>
      <p className="legal-lead">{isPrivacy
        ? 'Conoce qué información se utiliza al crear una cuenta, administrar un comercio o realizar un pedido, para qué se usa y cómo puedes ejercer tus derechos.'
        : 'Estas condiciones explican las reglas generales para utilizar CLICKOK como plataforma de gestión comercial y vitrina digital.'}</p>
      <div className="legal-meta"><span>Versión 1.0</span><span>Vigencia: 8 de noviembre de 2026</span><span>Jurisdicción: Colombia</span></div>

      {isPrivacy ? <>
        <section><h2>1. Identificación y alcance</h2>
          <p>Esta política describe el tratamiento de datos personales realizado a través de CLICKOK, plataforma tecnológica operada bajo la marca <strong>Atom Labs</strong> (en adelante, “CLICKOK”). Su aplicación se rige por el artículo 15 de la Constitución Política, la Ley 1581 de 2012, el Decreto 1074 de 2015 y las normas que los modifiquen o complementen.</p>
          <p><strong>Responsable para los datos de cuenta, relación comercial y soporte:</strong> Juan Pablo Burgos Vásquez, persona natural titular y responsable de la operación de Atom Labs y CLICKOK. Para proteger su identificación personal, el número de cédula no se publica en esta página. Teléfono de contacto: 304 490 5342. Correo para asuntos de privacidad: info@atomlabs.lat. El domicilio y la dirección física del responsable deberán incorporarse antes de la publicación definitiva.</p>
          <p><strong>Canal de privacidad:</strong> <a href="mailto:info@atomlabs.lat">info@atomlabs.lat</a>. Este canal debe habilitarse y monitorearse para recibir consultas y reclamos de titulares.</p>
          <p>CLICKOK es una plataforma multi-comercio. El comercio que publica una vitrina es, por regla general, responsable de los datos que recoge directamente de sus compradores para gestionar sus ventas, pedidos, entregas y atención. Atom Labs puede actuar como encargado de esos datos cuando los aloja o procesa por instrucciones del comercio. Para los datos de registro de la cuenta, administración de la plataforma, facturación propia, seguridad y soporte, Atom Labs actúa como responsable, según la finalidad concreta.</p>
        </section>
        <section><h2>2. Datos que podemos tratar</h2>
          <ul><li><strong>Datos de cuenta y comercio:</strong> nombre, correo electrónico, teléfono, nombre comercial, sector, credenciales de acceso protegidas y datos de configuración.</li>
          <li><strong>Datos de compradores:</strong> nombre, teléfono, dirección de entrega, contenido del pedido, notas que el comprador decida suministrar y estado del pedido.</li>
          <li><strong>Datos operativos:</strong> productos, inventario, ventas, clientes, usuarios autorizados, actividad de la cuenta y registros técnicos necesarios para prestar el servicio.</li>
          <li><strong>Datos técnicos:</strong> dirección IP, identificadores del dispositivo o navegador, registros de acceso, errores y datos de funcionamiento y seguridad.</li>
          <li><strong>Datos de pago:</strong> referencias, estado y confirmaciones de transacciones. Los datos de tarjeta y demás credenciales financieras se procesan mediante la pasarela correspondiente; CLICKOK no solicita que se escriban números completos de tarjeta ni códigos de seguridad en sus formularios.</li></ul>
          <p>No solicitamos datos sensibles como regla general. Si un usuario incluye voluntariamente información sensible en campos libres, debe evitar hacerlo salvo que sea estrictamente necesario y exista una base legal válida. CLICKOK no está diseñado para recolectar datos de niños, niñas o adolescentes.</p>
        </section>
        <section><h2>3. Finalidades del tratamiento</h2>
          <ul><li>Crear, autenticar y administrar cuentas de comercios y usuarios autorizados.</li><li>Configurar vitrinas, catálogos, productos, inventarios, pedidos, ventas y módulos contratados.</li><li>Transmitir al comercio la información necesaria para preparar, entregar y atender un pedido o solicitud.</li><li>Procesar y consultar el estado de pagos mediante proveedores de pago integrados, gestionar conciliaciones y prevenir transacciones fraudulentas.</li><li>Enviar comunicaciones operativas, avisos de seguridad, recuperación de acceso y notificaciones solicitadas o habilitadas por el usuario.</li><li>Prestar soporte, atender peticiones y reclamos, mantener la plataforma, diagnosticar errores y proteger las cuentas.</li><li>Cumplir obligaciones legales, contables, tributarias y requerimientos de autoridades competentes.</li><li>Mejorar el servicio mediante información estadística o agregada, procurando no identificar a los titulares cuando no sea necesario.</li></ul>
          <p>El envío de publicidad o comunicaciones comerciales no esenciales requerirá la autorización correspondiente y ofrecerá un mecanismo para dejar de recibirlas.</p>
        </section>
        <section><h2>4. Comercios y compradores: quién responde por los datos</h2>
          <p>Cuando un comprador diligencia un pedido en la vitrina de un comercio, ese comercio decide qué datos necesita para vender, entregar y atender la compra. El comercio debe informar su propia política de tratamiento, contar con la autorización que corresponda y atender las solicitudes relacionadas con esos datos. CLICKOK facilita el formulario y procesa la información como proveedor tecnológico bajo las instrucciones aplicables.</p>
          <p>Para ejercer derechos sobre información de una compra, el comprador puede contactar primero al comercio identificado en la vitrina. Si la solicitud se refiere a una cuenta de CLICKOK, a la seguridad de la plataforma o al tratamiento efectuado directamente por Atom Labs, puede utilizar el canal de privacidad indicado en esta política.</p>
        </section>
        <section><h2>5. Proveedores y transmisión de información</h2>
          <p>Para operar CLICKOK podemos utilizar proveedores tecnológicos de alojamiento, bases de datos, autenticación, correo electrónico, monitoreo y pagos. Entre los servicios integrados o previstos en la arquitectura se encuentran Supabase, Render, Resend y Wompi, según el módulo utilizado y la configuración vigente. Estos proveedores acceden únicamente a la información necesaria para prestar sus servicios, conforme a sus condiciones y a los acuerdos aplicables.</p>
          <p>En pagos con Wompi, el comercio conecta su propia cuenta cuando la integración está habilitada. Wompi procesa la transacción bajo sus propios términos y políticas; CLICKOK recibe los datos técnicos y estados necesarios para asociar la confirmación con el pedido. CLICKOK no almacena intencionalmente números completos de tarjeta ni códigos CVV.</p>
          <p>La prestación tecnológica puede implicar almacenamiento o tratamiento en infraestructura ubicada fuera de Colombia. Cuando corresponda, se aplicarán las reglas colombianas sobre transmisión o transferencia internacional de datos y las garantías contractuales exigibles. La lista de subencargados y sus ubicaciones debe mantenerse actualizada por el operador.</p>
          <p>No vendemos datos personales. No compartimos información para fines ajenos a la prestación del servicio, salvo autorización, obligación legal o los supuestos permitidos por la normativa.</p>
        </section>
        <section><h2>6. Cookies, almacenamiento local y notificaciones</h2>
          <p>CLICKOK puede utilizar almacenamiento local, cookies técnicas o tecnologías equivalentes para mantener sesiones, recordar preferencias, conservar configuraciones y proteger el funcionamiento del sitio. Si se incorporan herramientas de analítica, publicidad o seguimiento no esenciales, se informará su finalidad y se solicitará el consentimiento cuando sea exigible.</p>
          <p>Las notificaciones push son opcionales. El usuario puede conceder o retirar el permiso desde la configuración del navegador o del dispositivo. Para enviarlas se utiliza un identificador técnico de suscripción asociado al dispositivo y al comercio correspondiente.</p>
        </section>
        <section><h2>7. Derechos de los titulares</h2>
          <p>De acuerdo con la Ley 1581 de 2012, el titular puede conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización; conocer el uso dado a su información; presentar consultas y reclamos; solicitar la supresión del dato o revocar la autorización cuando proceda; y presentar quejas ante la Superintendencia de Industria y Comercio, una vez agotado el trámite previo ante el responsable o encargado.</p>
        </section>
        <section><h2>8. Cómo presentar consultas y reclamos</h2>
          <p>Envía tu solicitud a <a href="mailto:info@atomlabs.lat">info@atomlabs.lat</a> o comunícate al 304 490 5342, con el asunto “Protección de datos personales”. Indica tu nombre, medio de contacto, derecho que deseas ejercer, descripción clara de la solicitud y la información necesaria para verificar tu identidad. Si actúas por otra persona, adjunta el soporte de representación correspondiente. No envíes contraseñas ni datos completos de tarjetas.</p>
          <p>Las consultas se atenderán dentro de los diez (10) días hábiles siguientes a su recepción. Si no es posible responder en ese plazo, se informará el motivo y la nueva fecha, que no podrá superar cinco (5) días hábiles adicionales. Los reclamos se tramitarán conforme al artículo 15 de la Ley 1581 de 2012 y las reglas reglamentarias aplicables; si están incompletos, se solicitará subsanarlos dentro del término legal. Durante su trámite podrá incluirse la leyenda “reclamo en trámite” en los registros correspondientes.</p>
          <p>El titular podrá acudir a la Superintendencia de Industria y Comercio cuando haya agotado el trámite de consulta o reclamo ante el responsable o encargado, conforme a la ley.</p>
        </section>
        <section><h2>9. Conservación y eliminación</h2>
          <p>Los datos se conservarán durante el tiempo necesario para cumplir las finalidades informadas, mantener la relación contractual, atender garantías y reclamos, cumplir obligaciones legales y contables, y ejercer o defender derechos. Cumplidos esos fines y los plazos legales aplicables, se eliminarán, anonimizarán o archivarán con acceso restringido, según corresponda. Los comercios son responsables de definir y cumplir sus propios periodos de conservación para los datos de sus compradores.</p>
        </section>
        <section><h2>10. Seguridad</h2>
          <p>Aplicamos medidas técnicas, administrativas y organizativas razonables orientadas a proteger la información contra pérdida, alteración, consulta, uso o acceso no autorizado. Estas medidas pueden incluir controles de acceso, autenticación, separación de información por comercio, cifrado en tránsito y gestión de incidentes. Ningún sistema conectado a Internet puede garantizar seguridad absoluta; por ello, también pedimos a los usuarios proteger sus credenciales y asignar permisos solo a personas autorizadas.</p>
        </section>
        <section><h2>11. Actualizaciones de esta política</h2>
          <p>Podemos actualizar esta política para reflejar cambios legales, tecnológicos o de funcionamiento. La versión vigente estará publicada en esta página e indicará su fecha de actualización. Cuando un cambio requiera una nueva autorización, se solicitará antes de realizar el tratamiento correspondiente.</p>
        </section>
      </> : <>
        <section><h2>1. Identificación del servicio</h2><p>CLICKOK es una plataforma tecnológica de Atom Labs, cuya operación está a cargo de Juan Pablo Burgos Vásquez, persona natural. Para asuntos relacionados con estos términos: info@atomlabs.lat o 304 490 5342. El domicilio y la dirección física del responsable deberán incorporarse antes de la publicación definitiva.</p></section>
        <section><h2>2. Aceptación y cuenta</h2><p>Al crear una cuenta o utilizar las funciones privadas de CLICKOK, el usuario acepta estos términos y se compromete a suministrar información veraz, mantenerla actualizada y proteger sus credenciales. El titular de la cuenta es responsable de las actividades realizadas por los usuarios que autorice y debe retirar oportunamente accesos que ya no correspondan.</p></section>
        <section><h2>3. Responsabilidad del comercio</h2><p>Cada comercio es responsable de la legalidad de sus productos o servicios, precios, inventario, disponibilidad, promociones, información publicada, cumplimiento de pedidos, entregas, garantías, atención al consumidor y obligaciones tributarias. También debe contar con las autorizaciones necesarias para utilizar imágenes, marcas y contenidos que publique.</p><p>El comercio es responsable de informar a sus compradores sobre el tratamiento de sus datos personales y de atender las solicitudes relacionadas con sus ventas, sin perjuicio de las obligaciones que correspondan a CLICKOK como proveedor tecnológico.</p></section>
        <section><h2>4. Pedidos y pagos</h2><p>CLICKOK facilita la comunicación y gestión de pedidos entre compradores y comercios, pero no es el vendedor de los productos publicados por cada comercio. La compraventa se celebra entre el comprador y el comercio correspondiente. Cuando se habilite Wompi u otra pasarela, el procesamiento del pago estará sujeto también a los términos del proveedor y a la cuenta del comercio. Un pedido solo debe considerarse pagado cuando exista confirmación válida del proveedor de pagos o verificación del medio utilizado.</p></section>
        <section><h2>5. Uso permitido</h2><p>Está prohibido utilizar CLICKOK para actividades ilícitas, publicar productos prohibidos, vulnerar derechos de terceros, intentar acceder a cuentas o datos ajenos, interferir con la seguridad o disponibilidad del servicio, distribuir código malicioso o proporcionar información engañosa. Podemos restringir accesos cuando sea necesario para proteger la plataforma, a sus usuarios o cumplir una obligación legal, procurando informar al titular cuando sea posible.</p></section>
        <section><h2>6. Disponibilidad y cambios</h2><p>Procuramos mantener CLICKOK disponible y funcional, pero pueden presentarse interrupciones por mantenimiento, fallas de proveedores, conectividad, incidentes de seguridad o causas externas. Las funciones pueden evolucionar y variar según el plan, el tipo de comercio y la configuración contratada.</p></section>
        <section><h2>7. Propiedad intelectual</h2><p>La plataforma, su software, diseño, marca y elementos propios pertenecen a sus respectivos titulares. El comercio conserva los derechos sobre sus contenidos y concede únicamente las autorizaciones necesarias para alojarlos, mostrarlos y procesarlos con el fin de prestar el servicio. Ninguna disposición transfiere la propiedad de marcas o contenidos de una parte a otra.</p></section>
        <section><h2>8. Datos personales</h2><p>El tratamiento de datos personales se rige por la <Link href="/legal/privacidad">Política de tratamiento de datos personales y privacidad</Link>. El comercio debe cumplir sus obligaciones como responsable de los datos que recolecta de sus clientes y utilizar la plataforma conforme a las instrucciones y controles disponibles.</p></section>
        <section><h2>9. Planes, pagos y cancelación</h2><p>Los precios, límites, periodos y funcionalidades aplicables serán los informados al momento de contratar. Cualquier cobro de suscripción deberá ser presentado de forma clara antes de su confirmación. El usuario podrá solicitar la cancelación de su plan por los canales habilitados; la cancelación no elimina obligaciones pendientes ni registros que deban conservarse por ley.</p></section>
        <section><h2>10. Limitación y contacto</h2><p>En la medida permitida por la ley, CLICKOK no responde por la calidad, seguridad, legalidad o entrega de productos y servicios ofrecidos por los comercios, ni por acuerdos celebrados directamente entre comprador y vendedor. Esto no excluye responsabilidades que legalmente no puedan limitarse. Para soporte o asuntos relacionados con estos términos: <a href="mailto:info@atomlabs.lat">info@atomlabs.lat</a>.</p></section>
        <section><h2>11. Ley aplicable y modificaciones</h2><p>Estos términos se interpretan conforme a las leyes de la República de Colombia. Podrán actualizarse cuando cambie el servicio o la normativa. La versión vigente será la publicada en esta página; cuando la ley lo exija, solicitaremos aceptación expresa de los cambios.</p></section>
      </>}
      <aside className="legal-notice"><LockKeyhole size={19}/><p><strong>Transparencia y protección.</strong> Estos documentos son una versión inicial de implementación. Antes de su publicación definitiva debe incorporarse el domicilio y la dirección física del responsable y realizarse una revisión jurídica.</p></aside>
      <div className="legal-related">{isPrivacy ? <Link href="/legal/terminos">Consultar términos y condiciones <ArrowRight size={15}/></Link> : <Link href="/legal/privacidad">Consultar política de tratamiento de datos <ArrowRight size={15}/></Link>}</div>
    </article>
    <footer className="legal-footer"><span>CLICKOK · Una plataforma de Atom Labs</span><Link href="/">Volver al inicio</Link></footer>
  </main>;
}
