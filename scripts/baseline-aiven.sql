-- Baseline one-time for an existing Aiven database created before TypeORM
-- migration history was enabled. Run only after taking an Aiven backup and
-- verifying that the existing schema already contains these changes.
-- This inserts metadata only; it does not alter application tables or data.

START TRANSACTION;

INSERT INTO `migrations` (`timestamp`, `name`) VALUES
  (1786664727402, 'InicialEsquema1786664727402'),
  (1786700000000, 'ConsecutivoEgresoNovedad1786700000000'),
  (1786710000000, 'ConsecutivoInmueble1786710000000'),
  (1786720000000, 'SaldoFavorCredito1786720000000'),
  (1786730000000, 'AnulacionObligacionYRetiroEnTerminacion1786730000000'),
  (1786740000000, 'RetirarConsignacionYOtroMedioPago1786740000000'),
  (1786750000000, 'MedioPagoEnMovimiento1786750000000'),
  (1786760000000, 'PagoRealGastoNovedad1786760000000'),
  (1786770000000, 'MoraCobrable1786770000000'),
  (1786780000000, 'EliminarSuspendidoYHistorialContrato1786780000000'),
  (1786790000000, 'PropietarioYAsociacionInmueble1786790000000'),
  (1786800000000, 'IndiceUnicoCanonPorPeriodo1786800000000'),
  (1786810000000, 'SaldoPosteriorEnAplicacionPago1786810000000'),
  (1786820000000, 'ModuloCaja1786820000000'),
  (1786830000000, 'DescuentoDeposito1786830000000'),
  (1786840000000, 'CambioInmediatoExcedente1786840000000'),
  (1786850000000, 'FksObligatoriasAplicacionDetalle1786850000000'),
  (1786860000000, 'IndiceUnicoContratoActivoPorInmueble1786860000000'),
  (1786870000000, 'FksRealesReferenciasSueltas1786870000000'),
  (1786880000000, 'HistorialTasaMora1786880000000'),
  (1786890000000, 'DepositoLiquidadoEnContrato1786890000000'),
  (1786900000000, 'SaldoFavorConsumidoEnRecibo1786900000000'),
  (1786910000000, 'DescuentoDeudaEnLiquidacionDeposito1786910000000'),
  (1786920000000, 'DepositoGarantia1786920000000'),
  (1786930000000, 'AnulacionDescuentoDeposito1786930000000'),
  (1786940000000, 'IndicesCompuestosP4Migration1786940000000');

COMMIT;