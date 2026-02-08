class Complex {
    constructor(re, im) {
        this.re = re;
        this.im = im;
    }
    add(oth) {
        return new Complex(this.re + oth.re, this.im + oth.im);
    }
    sub(oth) {
        return new Complex(this.re - oth.re, this.im - oth.im);
    }
    mul(oth) {
        return new Complex(
            this.re * oth.re - this.im * oth.im,
            this.re * oth.im + this.im * oth.re
        );
    }
    div(oth) {
        const denom = oth.re * oth.re + oth.im * oth.im;
        return new Complex(
            (this.re * oth.re + this.im * oth.im) / denom,
            (this.im * oth.re - this.re * oth.im) / denom
        );
    }

    print() {
        console.log('%d + i * %d', this.re, this.im);
    }
}