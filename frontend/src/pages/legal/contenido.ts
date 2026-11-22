export interface SeccionLegal {
  titulo: string;
  parrafos?: string[];
  lista?: string[];
}

export interface DocumentoLegal {
  titulo: string;
  actualizado: string;
  secciones: SeccionLegal[];
}

export const TERMINOS: DocumentoLegal = {
  titulo: 'Términos y condiciones',
  actualizado: '2026-11-21',
  secciones: [
    {
      titulo: 'Qué es Venvios Express',
      parrafos: [
        'Venvios Express es un servicio de casillero internacional. Recibimos en nuestra oficina de Cúcuta, Colombia, los paquetes que compras en tiendas como Shein, AliExpress o Amazon, y los enviamos a Venezuela por MRW o Zoom.',
        'No somos la tienda: no vendemos los productos, no fijamos sus precios y no respondemos por la calidad de lo que compraste. Nuestro trabajo empieza cuando tu compra llega a nuestra oficina y termina cuando la transportista la entrega.',
      ],
    },
    {
      titulo: 'Tu cuenta y tu casillero',
      parrafos: [
        'Para usar el servicio necesitas una cuenta con tu nombre y apellido, tu número de cédula, tu correo y tu teléfono de WhatsApp. Al registrarte recibes un número de casillero personal con la forma VENV-000000.',
        'Eres responsable de que los datos sean verdaderos y de mantener tu contraseña en reserva. Las operaciones hechas desde tu cuenta con tu contraseña quedan a tu nombre. Si crees que alguien más entró a tu cuenta, cámbiala y avísanos por los canales de atención.',
      ],
    },
    {
      titulo: 'Cómo funciona el envío',
      lista: [
        'Prealerta: registras en tu cuenta el número de guía y el valor declarado de cada paquete, y la tienda de donde viene.',
        'Recepción: cuando el paquete llega a Cúcuta lo registramos en tu casillero y te avisamos por WhatsApp.',
        'Consolidación: eliges qué paquetes van juntos, la transportista (MRW o Zoom) y la modalidad de cobro. Los datos de entrega salen de tu perfil.',
        'Peso y cotización: pesamos el envío completo y te enviamos el total por WhatsApp. El peso es el físico del envío; no se usa peso volumétrico.',
        'Pago: pagas en dólares o en bolívares a la tasa BCV del día y subes el comprobante. Una persona de nuestro equipo verifica el pago antes de despachar.',
        'Despacho y entrega: registramos la guía de la transportista y te la compartimos. Tú confirmas cuando recibes el paquete.',
      ],
    },
    {
      titulo: 'Precios, peso y pagos',
      parrafos: [
        'Los precios se expresan en dólares. Si pagas en bolívares, se usa la tasa BCV del día publicada en el sitio. El total incluye el flete por kilo y el seguro de carga que corresponde a la modalidad que elegiste.',
        'En la modalidad de cobro a destino, el tramo dentro de Venezuela lo cobra directamente la transportista cuando entregas el paquete, y ese monto no pasa por Venvios. El pago a Venvios por el flete y el seguro sí debe estar confirmado antes del despacho.',
        'Las tarifas vigentes están publicadas en la página de inicio y el administrador puede actualizarlas. El precio que cuenta es el de la cotización que aceptas antes de pagar.',
        'El pago se verifica a mano revisando el comprobante. No hay verificación automática contra el banco ni contra Binance. Un pago con un monto distinto al cotizado se acuerda por los canales de atención.',
      ],
    },
    {
      titulo: 'Datos de entrega',
      parrafos: [
        'Los datos de quien recibe (nombre, cédula, teléfono, agencia, ciudad y estado) los guardas tú en tu perfil y se copian al envío cuando lo consolidas. Si están incompletos, el envío no se procesa.',
        'Puedes corregirlos mientras el envío no haya salido. Después del despacho, cualquier cambio se acuerda por WhatsApp con atención al cliente.',
      ],
    },
    {
      titulo: 'Contenido de los paquetes',
      parrafos: [
        'Declaras que el contenido de tus paquetes es lícito y que cumple las reglas de la tienda donde compraste y de la transportista que lo lleva. No abrimos los paquetes para revisar su contenido.',
        'Si una autoridad retiene un paquete, te avisamos y seguimos lo que esa autoridad indique.',
      ],
    },
    {
      titulo: 'Casos especiales',
      parrafos: [
        'Si un paquete llega dañado o equivocado, si pagaste de más o si pasa cualquier situación fuera de lo normal, escríbenos por WhatsApp y lo acordamos contigo. El sistema solo registra la decisión que se toma.',
      ],
    },
    {
      titulo: 'Uso del sitio',
      parrafos: [
        'No está permitido intentar entrar a cuentas ajenas, copiar datos de otros clientes, alterar el sistema ni usarlo para fines distintos al envío de tus compras. Podemos suspender una cuenta que incumpla estas reglas y avisarte por los canales de atención.',
      ],
    },
    {
      titulo: 'Propiedad intelectual',
      parrafos: [
        'La marca, los textos, las imágenes y el diseño de este sitio son de Venvios Express. No se pueden copiar para otro servicio sin permiso escrito.',
      ],
    },
    {
      titulo: 'Cambios',
      parrafos: [
        'Podemos actualizar estos términos cuando cambie el servicio. La fecha de la última actualización aparece al inicio de esta página. Si el cambio es importante, lo avisamos por los canales de atención.',
      ],
    },
  ],
};

export const PRIVACIDAD: DocumentoLegal = {
  titulo: 'Política de privacidad',
  actualizado: '2026-11-21',
  secciones: [
    {
      titulo: 'Quiénes somos',
      parrafos: [
        'Venvios Express presta el servicio de casillero internacional desde Cúcuta, Colombia, hacia Venezuela. Esta política explica qué datos personales usamos, para qué y cómo los protegemos.',
      ],
    },
    {
      titulo: 'Qué datos guardamos',
      lista: [
        'Para tu cuenta: nombre y apellido, número de cédula, correo electrónico, teléfono de WhatsApp y contraseña.',
        'Para la entrega: nombre, cédula y teléfono de quien recibe, y la agencia, ciudad y estado de MRW o Zoom.',
        'Para la operación: números de guía, tienda de origen, valor declarado, peso, montos y estado de cada envío.',
        'Para los pagos: método, referencia y la captura del comprobante.',
        'Registros técnicos de uso y de errores, sin cédula, teléfono, correo ni nombre completo.',
      ],
    },
    {
      titulo: 'Para qué los usamos',
      lista: [
        'Recibir, guardar, consolidar, pesar, cobrar y despachar tus paquetes.',
        'Contactarte por WhatsApp sobre tus paquetes, tus pagos y tus guías.',
        'Verificar pagos y llevar el historial de cada envío.',
        'Cumplir obligaciones legales y proteger la seguridad de las cuentas.',
      ],
    },
    {
      titulo: 'Quién los ve',
      parrafos: [
        'Los ve el personal autorizado de Venvios Express cuando lo necesita para atender tu envío. La transportista recibe solo los datos necesarios para entregar el paquete.',
        'Los proveedores tecnológicos que alojan el sitio, la base de datos, las fotos y el correo procesan los datos por cuenta nuestra. No vendemos tus datos ni los compartimos con terceros para publicidad.',
      ],
    },
    {
      titulo: 'Cómo los protegemos',
      parrafos: [
        'Las contraseñas se guardan con una huella irreversible (hash): nadie, ni nosotros, puede leer la contraseña original. La cédula y los datos de quien recibe se guardan cifrados y solo se abren con la llave del servidor.',
        'Las fotos de los paquetes y los comprobantes de pago no tienen dirección pública: solo se muestran a quien tiene permiso. El acceso a la base de datos está restringido al servidor de Venvios.',
      ],
    },
    {
      titulo: 'Cuánto tiempo los guardamos',
      parrafos: [
        'Guardamos tus datos mientras tu cuenta esté activa y mientras exista un envío o un pago en curso. Si pides eliminar tu cuenta, borramos tus datos salvo los que estemos obligados a conservar por una obligación legal o contable.',
      ],
    },
    {
      titulo: 'Tus derechos',
      parrafos: [
        'Puedes pedir acceso a tus datos, corregirlos o pedir su eliminación, y oponerte a un uso que no sea necesario para el servicio. Escríbenos por los canales de atención publicados al final de esta página y lo atendemos.',
        'En tu perfil puedes corregir tu nombre, tu correo y tu teléfono. La cédula solo la puede corregir el administrador, porque identifica tu cuenta.',
      ],
    },
    {
      titulo: 'Cookies',
      parrafos: [
        'Usamos solo las cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de medición.',
      ],
    },
    {
      titulo: 'Cambios en esta política',
      parrafos: [
        'Si cambiamos esta política, actualizamos la fecha de arriba. Si el cambio es importante, lo avisamos por los canales de atención.',
      ],
    },
  ],
};
