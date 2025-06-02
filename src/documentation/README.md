# Friendly Muscle Fitness Management System

## Overview
A comprehensive gym management system built with React, TypeScript, and Supabase.

## Features

### 1. Member Management
- Registration with photo upload
- Status tracking (active, grace, expired, suspended)
- Check-in validation
- Member history (check-ins, payments)

### 2. Walk-in Management
- Quick registration
- Age-based pricing (configurable)
- Multiple payment methods

### 3. Point of Sale (POS)
- Product catalog with photos
- Shopping cart
- Multiple payment methods
- Sales history
- Stock management
- CSV export

### 4. Administration
- Product management
- Coupon system
- Membership settings
  - Pricing configuration
  - Registration fees
  - Grace period settings
  - Walk-in fees
- Data export (CSV)
- User role management

## Technical Stack

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- Lucide Icons
- React Router DOM
- React Hot Toast

### Backend
- Supabase
  - Authentication
  - Database
  - Storage (photos)
  - Row Level Security

## Architecture

### State Management
- Zustand for global state
- React hooks for local state
- Supabase real-time subscriptions

### Security
- Role-based access control
- Protected routes
- Row Level Security policies

### File Storage
- Image compression before upload
- Secure URL generation
- Public access for product/member photos

## Database Schema

### Tables
1. users
   - Authentication and staff management
2. members
   - Member information and status
3. check_ins
   - Member and walk-in visits
4. payments
   - All financial transactions
5. products
   - POS inventory
6. coupons
   - Membership discount coupons
7. shifts
   - Staff shift management
8. settings
   - System configuration

## API Documentation

### Authentication
- Email/password login
- Session management
- Role verification

### Member Operations
- Create/Update members
- Check-in validation
- Status management
- History tracking

### POS Operations
- Product management
- Stock tracking
- Sales processing
- Payment recording

### Admin Operations
- User management
- Product/Coupon CRUD
- Settings management
- Data export

## Development Guidelines

### Code Style
- ESLint configuration
- TypeScript strict mode
- Component organization
- State management patterns

### Testing
- Unit tests with Vitest
- Component testing
- API integration testing

### Deployment
- Build optimization
- Environment configuration
- Performance monitoring

## Security Considerations

### Authentication
- Session management
- Password policies
- Role enforcement

### Data Protection
- Row Level Security
- Input validation
- SQL injection prevention

### File Upload
- File type validation
- Size limitations
- Secure storage

## Maintenance

### Backup
- Database backup strategy
- File storage backup
- Recovery procedures

### Monitoring
- Error tracking
- Performance metrics
- Usage statistics

### Updates
- Dependency management
- Security patches
- Feature additions

## Recent Updates

### 1.0.0 (2025-02-09)
- Initial release

### 1.1.0 (2025-02-10)
- Added membership settings panel
- Added CSV export functionality
- Enhanced documentation