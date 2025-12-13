import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ClientModal from '../components/ClientModal';

describe('ClientModal', () => {
  const mockClient = {
    nombre: 'Juan Pérez',
    email: 'juan@example.com',
    celular: '123456789',
    estado: 'Activo',
    fecha_registro: '2023-01-01T12:00:00Z',
    notas: 'Cliente importante',
  };

  test('SI no hay ningun cliente, no muestra nada',() => {
    const { container } = render(<ClientModal client={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  test('minfromacion del cliente', () => {
    render(<ClientModal client={mockClient} onClose={() => {}} />);
    expect(screen.getAllByText(/Juan Pérez/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/juan@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/123456789/i)).toBeInTheDocument();
    expect(screen.getByText(/Activo/i)).toBeInTheDocument();
    expect(screen.getByText(/Cliente importante/i)).toBeInTheDocument();
  });

  test('Se cierra el modal al hacer click en la x', () => {
    const onClose = jest.fn();
    render(<ClientModal client={mockClient} onClose={onClose} />);
    fireEvent.click(screen.getByText(/cerrar/i));
    expect(onClose).toHaveBeenCalled();
  });
});
