import { cn } from '@/lib/utils'

describe('Utils', () => {
  describe('cn (className utility)', () => {
    it('should merge class names', () => {
      const result = cn('class1', 'class2')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
    })

    it('should handle conditional classes', () => {
      const result = cn('always', true && 'conditional', false && 'never')
      expect(result).toContain('always')
      expect(result).toContain('conditional')
      expect(result).not.toContain('never')
    })

    it('should handle empty and undefined values', () => {
      const result = cn('class1', '', undefined, null, 'class2')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
      expect(result).not.toContain('undefined')
      expect(result).not.toContain('null')
    })

    it('should handle object-style classes', () => {
      const result = cn({
        'active': true,
        'inactive': false,
        'disabled': true
      })
      expect(result).toContain('active')
      expect(result).toContain('disabled')
      expect(result).not.toContain('inactive')
    })

    it('should merge Tailwind classes correctly', () => {
      // This tests the tailwind-merge functionality
      const result = cn('bg-red-500', 'bg-blue-500')
      // The second background should override the first
      expect(result).toContain('bg-blue-500')
      expect(result).not.toContain('bg-red-500')
    })

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
      expect(result).toContain('class3')
    })

    it('should handle complex nested combinations', () => {
      const isActive = true
      const size = 'large'
      
      const result = cn(
        'base-class',
        {
          'active': isActive,
          'inactive': !isActive
        },
        size === 'large' && 'size-large',
        ['additional', 'classes']
      )
      
      expect(result).toContain('base-class')
      expect(result).toContain('active')
      expect(result).toContain('size-large')
      expect(result).toContain('additional')
      expect(result).toContain('classes')
      expect(result).not.toContain('inactive')
    })

    it('should return empty string for no arguments', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('should handle only falsy values', () => {
      const result = cn(false, null, undefined, '')
      expect(result).toBe('')
    })
  })
})