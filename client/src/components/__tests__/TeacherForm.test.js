import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TeacherForm from '../TeacherForm';
import { SettingsProvider } from '../../contexts/SettingsContext';

test('shows validation errors when required fields missing', async () => {
  render(
    <SettingsProvider>
      <TeacherForm initialEmail="" />
    </SettingsProvider>
  );
  const submit = screen.getByRole('button', { name: /Submit application/i });
  fireEvent.click(submit);
  expect(await screen.findByText(/Please fill required fields/i)).toBeInTheDocument();
});
