import { spectraBank } from '@family-night/shared/wavelength-spectra';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { OneDeviceWavelength } from '../../games/wavelength/OneDeviceWavelength';

export const Route = createFileRoute('/un-dispositivo/wavelength')({
  component: OneDeviceWavelengthRoute,
});

function OneDeviceWavelengthRoute() {
  const navigate = useNavigate();
  return (
    <OneDeviceWavelength
      spectra={spectraBank}
      onBack={() => void navigate({ to: '/un-dispositivo' })}
      onHome={() => void navigate({ to: '/' })}
    />
  );
}
