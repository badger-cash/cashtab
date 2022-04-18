const bio = require('bufio');
const bcash = require('bcash');
const MTX = bcash.MTX;
const consensus = bcash.consensus;
const { hashType } = bcash.Script;
const { 
    SLP,
    common: { opcodes }
} = bcash.script;
const hash256 = require('bcrypto').Hash256;
const { i64, u64 } = require('n64');

export const authPubKeys = [
    {
        tokenId: '7e7dacd72dcdb14e00a03dd3aff47f019ed51a6f1f4e4f532ae50692f62bc4e5',
        pubkey: '027e6cf8229495afadcb5a7e40365bbc82afcf145eacca3193151e68a61fc81743',
        imageUrl: 'https://bux.digital/assets/img/favicon/favicon-32x32.png'
    }
]

export const buildOutScript = (authPubKey, checkIsFirstInput = false) => {
    const script = new bcash.Script()
        .pushSym('2dup')
        .pushInt(36)
        .pushSym('split')
        .pushSym('drop');

        if (checkIsFirstInput) {
            script.pushSym('dup')
            script.pushInt(6)
            script.pushSym('pick')
            script.pushInt(104)
            script.pushSym('split')
            script.pushSym('drop')
            script.pushInt(68)
            script.pushSym('split')
            script.pushSym('nip')
            script.pushSym('equalverify');
        }

        script.pushSym('swap')
        .pushSym('dup')
        .pushInt(78)
        .pushSym('split')
        .pushSym('nip')
        .pushInt(20)
        .pushSym('split')
        .pushSym('drop')
        .pushInt(7)
        .pushSym('pick')
        .pushSym('hash160')
        .pushSym('equalverify')

        .pushInt(132)
        .pushSym('split')
        .pushSym('drop')
        .pushSym('cat')
        .pushInt(3)
        .pushSym('roll')
        .pushSym('swap')
        .pushData(authPubKey)
        .pushSym('checkdatasigverify')
        .pushInt(2)
        .pushSym('roll')
        .pushSym('dup')
        .pushSym('size')
        .pushInt(40)
        .pushSym('sub')
        .pushSym('split')
        .pushSym('swap')
        .pushInt(4)
        .pushSym('split')
        .pushSym('nip')
        .pushInt(32)
        .pushSym('split')
        .pushSym('drop')
        .pushInt(3)
        .pushSym('roll')
        .pushSym('hash256')
        .pushSym('equalverify')
        .pushInt(32)
        .pushSym('split')
        .pushSym('drop')
        .pushSym('rot')
        .pushSym('hash256')
        .pushSym('equalverify')
        .pushSym('sha256')
        .pushSym('3dup')
        .pushSym('rot')
        .pushSym('size')
        .pushSym('1sub')
        .pushSym('split')
        .pushSym('drop')
        .pushSym('swap')
        .pushSym('rot')
        .pushSym('checkdatasigverify')
        .pushSym('drop')
        .pushSym('checksig')
        .compile();

    return script;
}

export class TXUtil extends MTX {

    constructor(options) {
        super(options);
    }

    /**
   * Witness sighashing -- O(n).
   * @private
   * @param {Number} index
   * @param {Script} prev
   * @param {Amount} value
   * @param {SighashType} type
   * @returns {Buffer}
   */

  getPreimage(index, prev, value, type, json = false) {
    const input = this.inputs[index];
    let prevouts = consensus.ZERO_HASH;
    let sequences = consensus.ZERO_HASH;
    let outputs = consensus.ZERO_HASH;

    if (!(type & hashType.ANYONECANPAY)) {
      if (this._hashPrevouts) {
        prevouts = this._hashPrevouts;
      } else {
        const bw = bio.pool(this.inputs.length * 36);

        for (const input of this.inputs)
          input.prevout.toWriter(bw);

        if (json) {
          const rawPrevouts= this.inputs.map(input => input.prevout.toRaw());
          prevouts = Buffer.concat(rawPrevouts);
        } else
          prevouts = hash256.digest(bw.render());

        if (!this.mutable && !json)
          this._hashPrevouts = prevouts;
      }
    }

    if (!(type & hashType.ANYONECANPAY)
        && (type & 0x1f) !== hashType.SINGLE
        && (type & 0x1f) !== hashType.NONE) {
      if (this._hashSequence) {
        sequences = this._hashSequence;
      } else {
        const bw = bio.pool(this.inputs.length * 4);

        for (const input of this.inputs)
          bw.writeU32(input.sequence);

        if (json)
          sequences = bw.render();
        else
          sequences = hash256.digest(bw.render());

        if (!this.mutable && !json)
          this._hashSequence = sequences;
      }
    }

    if ((type & 0x1f) !== hashType.SINGLE
        && (type & 0x1f) !== hashType.NONE) {
      if (this._hashOutputs) {
        outputs = this._hashOutputs;
      } else {
        let size = 0;

        for (const output of this.outputs)
          size += output.getSize();

        const bw = bio.pool(size);

        for (const output of this.outputs)
          output.toWriter(bw);

        if (json) {
          const rawOutputs= this.outputs.map(output => output.toRaw());
          outputs = Buffer.concat(rawOutputs);
        } else
          outputs = hash256.digest(bw.render());

        if (!this.mutable && !json)
          this._hashOutputs = outputs;
      }
    } else if ((type & 0x1f) === hashType.SINGLE) {
      if (index < this.outputs.length) {
        const output = this.outputs[index];
        if (json)
          outputs = output.toRaw();
        else
          outputs = hash256.digest(output.toRaw());
      }
    }

    if (json) {
        const locktimeBuf = Buffer.alloc(4);
        locktimeBuf.writeUInt32LE(this.locktime);
        const typeBuf = Buffer.alloc(4);
        typeBuf.writeUInt32LE(type);
        return {
            version: this.version,
            prevouts: prevouts,
            sequences: sequences,
            outpoint: input.prevout.toRaw(),
            scriptCode: prev.toRaw(),
            inputValue: i64.fromInt(value).toLE(Buffer),
            inputSequence: input.sequence,
            outputs: outputs,
            locktime: locktimeBuf,
            type: typeBuf  
        }
    }

    const size = 156 + prev.getVarSize();
    const bw = bio.pool(size);

    bw.writeU32(this.version);
    bw.writeBytes(prevouts);
    bw.writeBytes(sequences);
    bw.writeHash(input.prevout.hash);
    bw.writeU32(input.prevout.index);
    bw.writeVarBytes(prev.toRaw());
    bw.writeI64(value);
    bw.writeU32(input.sequence);
    bw.writeBytes(outputs);
    bw.writeU32(this.locktime);
    bw.writeU32(type);

    return bw.render();
  }
}