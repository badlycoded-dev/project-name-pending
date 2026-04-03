import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AddCourseForm from '../AddCourseForm';
import { SettingsProvider } from '../../contexts/SettingsContext';

test('shows validation errors when required fields missing', async () => {
  render(
    <SettingsProvider>
      <AddCourseForm />
    </SettingsProvider>
  );

  const submit = screen.getByRole('button', { name: /Create course/i });
  fireEvent.click(submit);
  expect(await screen.findByText(/Please fill required fields/i)).toBeInTheDocument();
});
