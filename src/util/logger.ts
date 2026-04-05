const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export class Logger {
  private spinnerInterval?: ReturnType<typeof setInterval>
  private spinnerFrame = 0
  private currentMessage = ''

  info(msg: string) {
    this.clearSpinner()
    console.log(`  ${msg}`)
  }

  success(msg: string) {
    this.clearSpinner()
    console.log(`✓ ${msg}`)
  }

  warn(msg: string) {
    this.clearSpinner()
    console.warn(`⚠ ${msg}`)
  }

  error(msg: string) {
    this.clearSpinner()
    console.error(`✗ ${msg}`)
  }

  startSpinner(msg: string) {
    this.stopSpinner()
    this.currentMessage = msg
    this.spinnerFrame = 0
    if (process.stdout.isTTY) {
      this.spinnerInterval = setInterval(() => {
        process.stdout.write(`\r${SPINNER_FRAMES[this.spinnerFrame % SPINNER_FRAMES.length]} ${this.currentMessage}`)
        this.spinnerFrame++
      }, 80)
    } else {
      console.log(`... ${msg}`)
    }
  }

  stopSpinner(finalMsg?: string) {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval)
      this.spinnerInterval = undefined
      if (process.stdout.isTTY) {
        process.stdout.write('\r\x1b[K')
      }
    }
    if (finalMsg) {
      this.success(finalMsg)
    }
  }

  private clearSpinner() {
    if (this.spinnerInterval && process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K')
    }
  }
}

export const logger = new Logger()
