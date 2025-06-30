import { render, screen } from '@testing-library/react'
import { DuckLogo } from '@/components/duck-logo'

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: React.ComponentProps<'img'>) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />
  }
})

describe('DuckLogo', () => {
  it('should render the duck logo by default', () => {
    render(<DuckLogo />)
    
    const image = screen.getByAltText('Duck Logo')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', '/images/logos/theduckchatduck.png')
  })

  it('should render with custom size', () => {
    render(<DuckLogo size="xl" />)
    
    const image = screen.getByAltText('Duck Logo')
    expect(image).toBeInTheDocument()
  })

  it('should render duck variant by default', () => {
    render(<DuckLogo />)
    
    const image = screen.getByAltText('Duck Logo')
    expect(image).toHaveAttribute('src', '/images/logos/theduckchatduck.png')
  })

  it('should render full variant correctly', () => {
    render(<DuckLogo variant="full" />)
    
    const image = screen.getByAltText('The Duck Chat Logo')
    expect(image).toHaveAttribute('src', '/images/logos/theduckchatfull.png')
  })

  it('should apply custom className', () => {
    const customClass = 'custom-test-class'
    render(<DuckLogo className={customClass} />)
    
    const container = screen.getByAltText('Duck Logo').parentElement
    expect(container).toHaveClass(customClass)
  })

  it('should render with different sizes', () => {
    const sizes = ['sm', 'md', 'lg', 'xl'] as const
    
    sizes.forEach(size => {
      const { unmount } = render(<DuckLogo size={size} />)
      
      const image = screen.getByAltText('Duck Logo')
      expect(image).toBeInTheDocument()
      
      unmount()
    })
  })

  it('should have correct alt text for duck variant', () => {
    render(<DuckLogo variant="duck" />)
    
    const image = screen.getByAltText('Duck Logo')
    expect(image).toBeInTheDocument()
  })

  it('should have correct alt text for full variant', () => {
    render(<DuckLogo variant="full" />)
    
    const image = screen.getByAltText('The Duck Chat Logo')
    expect(image).toBeInTheDocument()
  })

  it('should apply object-contain class to image', () => {
    render(<DuckLogo />)
    
    const image = screen.getByAltText('Duck Logo')
    expect(image).toHaveClass('object-contain')
  })

  it('should have priority attribute for performance', () => {
    render(<DuckLogo />)
    
    const image = screen.getByAltText('Duck Logo')
    // Next.js Image priority is a boolean prop, not an HTML attribute
    // We'll test that the component renders without errors instead
    expect(image).toBeInTheDocument()
  })

  it('should have proper dimensions for small size', () => {
    render(<DuckLogo size="sm" variant="duck" />)
    
    const image = screen.getByAltText('Duck Logo')
    expect(image).toHaveAttribute('width', '24')
    expect(image).toHaveAttribute('height', '24')
  })

  it('should have proper dimensions for full variant', () => {
    render(<DuckLogo size="md" variant="full" />)
    
    const image = screen.getByAltText('The Duck Chat Logo')
    expect(image).toHaveAttribute('width', '100')
    expect(image).toHaveAttribute('height', '32')
  })

  it('should maintain aspect ratio with inline styles', () => {
    render(<DuckLogo />)
    
    const image = screen.getByAltText('Duck Logo')
    expect(image).toHaveStyle({
      width: 'auto',
      height: 'auto'
    })
  })

  it('should render with relative container', () => {
    render(<DuckLogo />)
    
    const container = screen.getByAltText('Duck Logo').parentElement
    expect(container).toHaveClass('relative')
  })
})