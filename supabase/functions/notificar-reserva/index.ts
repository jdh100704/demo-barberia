Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const reserva = payload.record // Supabase manda la fila nueva dentro de "record"

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const EMAIL_DUENO = Deno.env.get('EMAIL_DUENO')

    const servicios = reserva.servicios.map((s: any) => `${s.nombre} (${s.precio}€)`).join(', ')

    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Reservas <onboarding@resend.dev>', // dominio de pruebas de Resend
        to: EMAIL_DUENO,
        subject: `Nueva reserva: ${reserva.nombre_cliente}`,
        html: `
          <h2>Nueva reserva</h2>
          <p><strong>Cliente:</strong> ${reserva.nombre_cliente}</p>
          <p><strong>Teléfono:</strong> ${reserva.telefono}</p>
          <p><strong>Fecha:</strong> ${reserva.fecha} a las ${reserva.hora}</p>
          <p><strong>Barbero:</strong> ${reserva.barbero}</p>
          <p><strong>Servicios:</strong> ${servicios}</p>
          <p><strong>Total:</strong> ${reserva.total}€</p>
          ${reserva.notas ? `<p><strong>Notas:</strong> ${reserva.notas}</p>` : ''}
        `,
      }),
    })

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      console.error('Error de Resend:', errorTexto)
      return new Response(JSON.stringify({ error: errorTexto }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error('Error en la función:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})