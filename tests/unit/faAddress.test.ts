import { AccountAddress } from "../../src/core/accountAddress";
import { FaAddress } from "../../src/transactions/faAddress";
import { TypeTagStruct } from "../../src/transactions/typeTag";

describe("FaAddress", () => {
  const usdct = "0xc745ffa4f97fa9739fae0cb173996f70bb8e4b0310fa781ccca2f7dc13f7db06";

  test("native Cedra encodes as 0x1::cedra_coin::CedraCoin", () => {
    const tag = FaAddress.nativeCedra().toTypeTag();
    expect(tag.toString()).toBe("0x1::cedra_coin::CedraCoin");
    expect(FaAddress.fromTypeTag(tag).isNativeCedra()).toBe(true);
    expect(FaAddress.fromTypeTag(tag).useFeeV2()).toBe(false);
  });

  test("FA symbol encodes with lowercase module", () => {
    const tag = FaAddress.fromString(`${usdct}::USDCT`).toTypeTag();
    expect(tag.isStruct()).toBe(true);
    if (tag instanceof TypeTagStruct) {
      expect(tag.value.moduleName.identifier).toBe("usdct");
      expect(tag.value.name.identifier).toBe("USDCT");
      expect(tag.value.address.equals(AccountAddress.from(usdct))).toBe(true);
    }
    const decoded = FaAddress.fromTypeTag(tag);
    expect(decoded.symbol).toBe("USDCT");
    expect(decoded.useFeeV2()).toBe(true);
  });

  test("legacy module is ignored except CedraCoin", () => {
    const tag = FaAddress.fromString(`${usdct}::other_mod::USDCT`).toTypeTag();
    expect(tag instanceof TypeTagStruct && tag.value.moduleName.identifier).toBe("usdct");
    expect(FaAddress.fromString("0x1::cedra_coin::CedraCoin").isNativeCedra()).toBe(true);
  });

  test("empty encodes as bool", () => {
    const tag = FaAddress.empty().toTypeTag();
    expect(tag.isBool()).toBe(true);
    expect(FaAddress.fromTypeTag(tag).isEmpty()).toBe(true);
  });
});
