const { Op } = require('sequelize');
const Decimal = require('decimal.js');
const { sequelize, Venta, DetalleVenta, Producto, Usuario, Cliente } = require('../models');
const { presentarVenta, presentarLista } = require('../presenters/venta.presenter');

const registrar = async (req, res) => {
  try {
    const { cliente_id, metodo_pago, monto_recibido, items, tipo_comprobante, cliente_dni, cliente_ruc, cliente_razon_social, cliente_direccion } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ mensaje: 'La venta debe tener al menos un producto' });
    }

    const venta = await sequelize.transaction(async (t) => {
      let monto_total = new Decimal(0);
      const detallesData = [];

      for (const item of items) {
        const producto = await Producto.findByPk(item.producto_id, { transaction: t });
        if (!producto || !producto.activo) {
          throw { status: 400, mensaje: 'Producto no encontrado o inactivo' };
        }
        let productoADescontar = producto;
        let cantidadADescontar = item.cantidad;

        if (producto.es_paquete && producto.producto_base_id) {
          const productoBase = await Producto.findByPk(producto.producto_base_id, { transaction: t });
          if (!productoBase) throw { status: 400, mensaje: `Producto base no encontrado para: ${producto.nombre}` };
          productoADescontar = productoBase;
          cantidadADescontar = item.cantidad * producto.cantidad_paquete;
        }

        if (productoADescontar.stock < cantidadADescontar) {
          throw { status: 400, mensaje: `Stock insuficiente de ${productoADescontar.nombre} para vender ${producto.nombre}` };
        }

        // Usar decimal.js para exactitud financiera
        const precioUnitario = new Decimal(producto.precio);
        const subtotal = precioUnitario.times(item.cantidad);
        monto_total = monto_total.plus(subtotal);

        detallesData.push({
          producto_id:     item.producto_id,
          cantidad:        item.cantidad,
          precio_unitario: precioUnitario.toFixed(2),
          subtotal:        subtotal.toFixed(2),
        });

        productoADescontar.stock -= cantidadADescontar;
        if (productoADescontar.stock === 0) productoADescontar.fecha_vencimiento = null;
        await productoADescontar.save({ transaction: t });
      }

      if (metodo_pago === 'Efectivo') {
        const recibido = new Decimal(monto_recibido || 0);
        if (recibido.lessThan(monto_total)) {
          throw { status: 400, mensaje: 'Monto recibido insuficiente' };
        }
      }

      const vuelto = metodo_pago === 'Efectivo'
        ? new Decimal(monto_recibido).minus(monto_total)
        : new Decimal(0);

      const nuevaVenta = await Venta.create({
        usuario_id:    req.usuario.id,
        cliente_id:    cliente_id || null,
        metodo_pago,
        monto_total:   monto_total.toFixed(2),
        monto_recibido: metodo_pago === 'Efectivo' ? new Decimal(monto_recibido).toFixed(2) : null,
        vuelto:        vuelto.toFixed(2),
        tipo_comprobante: tipo_comprobante || 'Boleta',
        cliente_dni:   cliente_dni || null,
        cliente_ruc:   cliente_ruc || null,
        cliente_razon_social: cliente_razon_social || null,
        cliente_direccion: cliente_direccion || null,
      }, { transaction: t });

      const detalles = await DetalleVenta.bulkCreate(
        detallesData.map((d) => ({ ...d, venta_id: nuevaVenta.id })),
        { transaction: t }
      );

      return { venta: nuevaVenta, detalles };
    });

    const ventaCompleta = await Venta.findByPk(venta.venta.id, {
      include: [
        { association: 'usuario', attributes: ['id', 'nombre'], paranoid: false },
        { association: 'cliente', attributes: ['id', 'nombre', 'dni'], paranoid: false },
        {
          association: 'detalles',
          include: [{ association: 'producto', attributes: ['id', 'nombre', 'marca'], paranoid: false }],
        },
      ],
    });

    return res.status(201).json(presentarVenta(ventaCompleta));
  } catch (err) {
    if (err.status && err.mensaje) {
      return res.status(err.status).json({ mensaje: err.mensaje });
    }
    console.error('Error en registrar venta:', err);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const listar = async (req, res) => {
  try {
    const { fecha_inicio, fecha_hasta, metodo_pago, page, limit } = req.query;
    const where = {};

    if (fecha_inicio && fecha_hasta) {
      where.createdAt = { [Op.between]: [new Date(fecha_inicio), new Date(fecha_hasta)] };
    } else if (fecha_inicio) {
      where.createdAt = { [Op.gte]: new Date(fecha_inicio) };
    } else if (fecha_hasta) {
      where.createdAt = { [Op.lte]: new Date(fecha_hasta) };
    }

    if (metodo_pago) {
      where.metodo_pago = metodo_pago;
    }

    const limitParsed = limit ? parseInt(limit, 10) : undefined;
    const offset = page && limitParsed ? (parseInt(page, 10) - 1) * limitParsed : 0;

    const { count, rows } = await Venta.findAndCountAll({
      where,
      include: [
        { association: 'usuario', attributes: ['id', 'nombre'], paranoid: false },
        { association: 'cliente', attributes: ['id', 'nombre', 'dni'], paranoid: false },
        {
          association: 'detalles',
          include: [{ association: 'producto', attributes: ['id', 'nombre', 'marca'], paranoid: false }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: limitParsed,
      offset: limitParsed ? offset : undefined,
    });

    return res.status(200).json({
      total: count,
      paginas: limitParsed ? Math.ceil(count / limitParsed) : 1,
      pagina_actual: page ? parseInt(page, 10) : 1,
      data: presentarLista(rows)
    });
  } catch (err) {
    console.error('Error en listar ventas:', err);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const obtener = async (req, res) => {
  try {
    const venta = await Venta.findByPk(req.params.id, {
      include: [
        { association: 'usuario', attributes: ['id', 'nombre'], paranoid: false },
        { association: 'cliente', attributes: ['id', 'nombre', 'dni'], paranoid: false },
        {
          association: 'detalles',
          include: [{ association: 'producto', attributes: ['id', 'nombre', 'marca'], paranoid: false }],
        },
      ],
    });

    if (!venta) {
      return res.status(404).json({ mensaje: 'Venta no encontrada' });
    }

    return res.status(200).json(presentarVenta(venta));
  } catch (err) {
    console.error('Error en obtener venta:', err);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const registrarBulk = async (req, res) => {
  try {
    const { ventas } = req.body;
    if (!ventas || !Array.isArray(ventas)) {
      return res.status(400).json({ mensaje: 'El cuerpo debe contener un arreglo de ventas' });
    }

    const resultados = [];
    const errores = [];

    // Procesamos cada venta. Si una falla, no afecta a las demás.
    // En producción, es mejor usar Promise.allSettled si el orden no importa,
    // pero aquí lo iteramos secuencialmente para respetar el stock.
    for (const vData of ventas) {
      try {
        const ventaRes = await sequelize.transaction(async (t) => {
          let monto_total = new Decimal(0);
          const detallesData = [];

          for (const item of vData.items) {
            const producto = await Producto.findByPk(item.producto_id, { transaction: t });
            if (!producto || !producto.activo) throw new Error(`Producto no encontrado o inactivo: ${item.producto_id}`);

            let productoADescontar = producto;
            let cantidadADescontar = item.cantidad;

            if (producto.es_paquete && producto.producto_base_id) {
              const productoBase = await Producto.findByPk(producto.producto_base_id, { transaction: t });
              if (!productoBase) throw new Error(`Producto base no encontrado para: ${producto.nombre}`);
              productoADescontar = productoBase;
              cantidadADescontar = item.cantidad * producto.cantidad_paquete;
            }

            if (productoADescontar.stock < cantidadADescontar) throw new Error(`Stock insuficiente para: ${productoADescontar.nombre}`);

            const precioUnitario = new Decimal(producto.precio);
            const subtotal = precioUnitario.times(item.cantidad);
            monto_total = monto_total.plus(subtotal);

            detallesData.push({
              producto_id: item.producto_id,
              cantidad: item.cantidad,
              precio_unitario: precioUnitario.toFixed(2),
              subtotal: subtotal.toFixed(2),
            });

            productoADescontar.stock -= cantidadADescontar;
            if (productoADescontar.stock === 0) productoADescontar.fecha_vencimiento = null;
            await productoADescontar.save({ transaction: t });
          }

          let montoRecibidoStr = vData.monto_recibido;
          if (vData.metodo_pago === 'Efectivo') {
            const recibido = new Decimal(montoRecibidoStr || 0);
            if (recibido.lessThan(monto_total)) throw new Error('Monto recibido insuficiente');
          }

          const vuelto = vData.metodo_pago === 'Efectivo'
            ? new Decimal(montoRecibidoStr).minus(monto_total)
            : new Decimal(0);

          const nuevaVenta = await Venta.create({
            usuario_id: vData.usuario_id || req.usuario.id, // Si el frontend envía usuario de la sesión offline
            cliente_id: vData.cliente_id || null,
            metodo_pago: vData.metodo_pago,
            monto_total: monto_total.toFixed(2),
            monto_recibido: vData.metodo_pago === 'Efectivo' ? new Decimal(montoRecibidoStr).toFixed(2) : null,
            vuelto: vuelto.toFixed(2),
            tipo_comprobante: vData.tipo_comprobante || 'Boleta',
            cliente_dni: vData.cliente_dni || null,
            cliente_ruc: vData.cliente_ruc || null,
            cliente_razon_social: vData.cliente_razon_social || null,
            cliente_direccion: vData.cliente_direccion || null,
            // Guardar con la fecha original de cuando se hizo offline
            createdAt: vData.fecha_offline ? new Date(vData.fecha_offline) : new Date(),
          }, { transaction: t });

          await DetalleVenta.bulkCreate(
            detallesData.map((d) => ({ ...d, venta_id: nuevaVenta.id })),
            { transaction: t }
          );

          return nuevaVenta.id;
        });
        resultados.push(ventaRes);
      } catch (err) {
        errores.push({ venta: vData, error: err.message });
      }
    }

    return res.status(200).json({
      mensaje: 'Sincronización finalizada',
      procesadas: resultados.length,
      errores,
      ids_exitosos: resultados,
    });
  } catch (err) {
    console.error('Error en registrarBulk:', err);
    return res.status(500).json({ mensaje: 'Error interno en sincronización bulk' });
  }
};

module.exports = { registrar, listar, obtener, registrarBulk };
