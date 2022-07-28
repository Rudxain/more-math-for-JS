import {isBigInt as isIntN} from '../helper/type check'
import {isInt, isInfNaN} from '../helper/value check'
import {autoN, toNumeric} from '../helper/sanitize'
import {abs} from './std'
import {trunc} from './rounding'
import {ctz} from './bitwise'
import {M as nthMersenne, isM as isMersenne} from './Mersenne'
import {isSquare, isCube} from './power'
import {sqrt, cbrt} from './root'

const Float = Number, isNan = x => x != x

export const isDivisible = (n, d) => {
	n = n?.valueOf(); d = d?.valueOf()
	return typeof n == typeof d && isInt(n) && isInt(d) && d && !(n % d)
}

/**
Euclidean algorithm for finding Highest Common Factor.
returns correct values when inputs are rational numbers
whose denominators are any power of 2 (including 2^0)
@return {numeric}
*/
export const Euclid = (a, b) => {while (b) [a, b] = [b, a % b]; return abs(a)}

//BEHOLD THE ULTIMATE GCD ALGORITHM (ok maybe I exaggerated)
export const gcd = (a, b) => {//should be variadic
	a = abs(toNumeric(a))
	b = abs(toNumeric(b))
	if ( isIntN(a) && isIntN(b) ) {
		if (a == b || !a) return b; if (!b) return a
		if (abs(a - b) == 1n) return 1n //does this improve speed?
		const i = ctz(a), j = ctz(b), k = i < j ? i : j; //min
		//reduce sizes
		a >>= i; b >>= j
		//REMINDER: every `return` after this point MUST be shifted by `k` to the left
		if (a == b) return a << k //again, does this improve speed?
		/*
		Stein's algorithm is slow when any argument is 1,
		especially if the other argument is a big Mersenne.
		So return early when any value is 1
		*/
		if (a == 1n || b == 1n || abs(a - b) == 1n) return 1n << k
		/*
		Stein alg made me realize that the
		GCD of 2 Mersenne numbers is another Mersenne
		whose size (exponent) equals the GCD of the sizes of the args.
		Example: GCD(0b111_111, 0b1111_1111) = 0b11
		because GCD(6, 8) = 2.
		In case you didn't know,
		`bigMersenne - smallMersenne == bigMersenne ^ smallMersenne`.
		I did some research and apparently it works for ANY base, not just 2:
		https://math.stackexchange.com/a/11570
		*/
		if (isMersenne(a) && isMersenne(b))
			return nthMersenne(gcd(sizeOf(a, 1n, 1n), sizeOf(b, 1n, 1n))) << k

		//set base ("Beta") of Lehmer's algo to `2 ** (2 ** BIN)`
		const BIN = 8n

		if (b > a) [a, b] = [b, a]
		const a_len = sizeOf(a, 1n << BIN, 1n), b_len = sizeOf(b, 1n << BIN, 1n)
		if (b_len < 2) {
			//both are small, Euclid is best here
			if (a_len < 2) return Euclid(a, b) << k;
			/*
			else: the larger is too large
			but the smaller is too small,
			so use Stein alg:
			en.wikipedia.org/wiki/Binary_GCD_algorithm#Implementation
			*/
			for (;;){ //`undefined == true` lol
				if (a > b) [a, b] = [b, a]
				b -= a
				if (!b) return a << k
				b >>= ctz(b)
			}
		}
		/*
		else: BOTH TOO LARGE
		definitely use Lehmer's algorithm
		en.wikipedia.org/wiki/Lehmer%27s_GCD_algorithm#Algorithm
		*/
		let m = a_len - b_len
		//this will sometimes make `b > a` true, I will fix it soon
		b <<= m << BIN; m = a_len
		while (a && b) {
			m--
			let x = a >> (m << BIN),
				y = b >> (m << BIN),
				[A, B, C, D] = [1n, 0n, 0n, 1n]
			for (;;){
				let w0 = (x + A) / (y + C),
					w1 = (x + B) / (y + D),
					w;
				//I'm afraid of deleting the `else` lol
				if (w0 != w1) {break} else w = w0;
				[A, B, x,
				C, D, y] = [
					C, D, y,
					A - w*C, B - w*D, x - w*y
				];
				if (B) continue
			}
			if (!B) {
				//is the order correct? if a < b, this will just swap them
				if (b) [a, b] = [b, a % b]
				continue
			}
			[a, b] = [a*A + b*B, C*a + D*b]
			if (b) continue
		}
		return a << k
	}
	else
	{
		if (isNan(x) || isNan(y)) return NaN
		if (!isInt(x) || !isInt(y)) return Euclid(x, y)
		//borrowed from Stein, lol
		const i = ctz(x), j = ctz(y),
			k = i < j ? i : j; //min
		//ensure the max length is 53b
		x /= 2 ** i; y /= 2 ** j
		return (isMersenne(x) && isMersenne(y)
			? 2 ** gcd(trunc(lb(x)) + 1, trunc(lb(y)) + 1) - 1
			: Euclid(x, y)) * 2 ** k
	}
}
//should `abs` be a tail-call in all of these (GCDs and LCMs)? it seems better to use it at the start
export const lcm = (a, b) => {
	a = abs(toNumeric(a))
	b = abs(toNumeric(b))
	return a == 0 && b == 0 ? a ^ b : a / gcd(a, b) * b
	//lower overflow probability and better performance than `a * b / gcd(a, b)`
}

//2nd lowest common divisor
//the 1st is always 1
export const lcd = (a, b) => {
	a = abs(toNumeric(a)); b = abs(toNumeric(b))
	const rt = sqrt(a * b), ONE = autoN(1, a)
	for (let i = autoN(2, ONE); i <= rt; i++) if (!(a % i || b % i)) return i
	return ONE
}

//returns ALL divisors of x, proper and trivial
//it's a generator, because arrays are too expensive for memory
export const divisors = function* (x) {
	x = trunc( abs( toNumeric(x) ) )
	if (isInfNaN(x)) return
	yield autoN(1, x)
	const n2 = autoN(2, x)
	if ( !(x % n2) ) yield n2
	for (let i = autoN(3, x); i <= x; i += n2)
		if ( !(x % i) ) yield i
}

//array of sorted Primes, no gaps (dense)
const Pa = [3, 5], //2 is unnecessary because CTZ
//Primality "dictionary", any order, gaps allowed (sparse)
	Pd = new Set([2, 3, 5])
//find next prime and store it
const addP = () => {
	let x = Pa[Pa.length - 1] + 2
	loop: for (;; x += 2) {
		if (Pd.has(x)) break
		if (isSquare(x)) continue
		let j = 0
		while (Pa[j] <= sqrt(x)) if (x % Pa[j++] == 0) continue loop
		Pd.add(x); break
	}
	Pa[Pa.length] = x
}
//remember, those 3 constants are static, so their data is preserved between calls to `factorize`
export const factorize = x => {
	x = trunc(abs(Float(x)))
	if (isInfNaN(x)) return //returning `undefined` is "more correct"
	const out = new Map, tz = ctz(x)
	if (tz) {out.set(2, tz); x /= 2 ** tz}
	if (x < 2) return out
	let rt = 1, y = sqrt(x)
	//trial rooting
	while (isSquare(x)) {x = y; y = sqrt(y); rt *= 2}
	y = cbrt(x)
	while (isCube(x)) {x = y; y = cbrt(y); rt *= 3}
	if (Pd.has(x)) {out.set(x, rt); return out}
	let i = 0; y = sqrt(x)
	//trial division on steroids
	while (Pa[i] <= y && Pa[i] <= x) {
		while (x % Pa[i] == 0) {
			out.set(Pa[i], (out.get(Pa[i]) || 0) + rt)
			x /= Pa[i]
			if (Pd.has(x)) {
				out.set(x, (out.get(x) || 0) + rt)
				return out
			}
		}
		if (++i >= Pa.length) addP() //Primes on-demand
	}
	if (x > 1) {out.set(x, (out.get(x) || 0) + rt); Pd.add(x)}
	return out
}

export const toFraction = x => {
	x = x?.valueOf()
	if (isInt(x) || isNan(x)) return [x, 1]
	const s = x < 0; if (s) x = -x //abs
	if (x == Infinity) return [s ? -1 : 1, 0]
	const n = trunc(x); x -= n
	let f0 = [0, 1], f1 = [1, 1], midOld = NaN //ensure same-type comparison
	for (;;){
		const fm = [f0[0] + f1[0], f0[1] + f1[1]], mid = fm[0] / fm[1]
		//guaranteed to halt
		if (mid == x || midOld == mid) {fm[0] += n * fm[1]; if (s) fm[0] *= -1; return fm}
		mid < x ? f0 = fm : f1 = fm
		midOld = mid
	}
}

/*
TO-DO: add function to test if number equals sum of divisors
with the option to include or exclude 1
*/