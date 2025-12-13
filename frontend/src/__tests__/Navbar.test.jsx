import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';

describe('Navbar', () => {
  test('Muestra el texto principal', () => {
    const mockAuth = { user: { nombre: 'Test User' } };
    render(
      <AuthContext.Provider value={{ auth: mockAuth }}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </AuthContext.Provider>
    );
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });
});
