// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {MosaicERC721} from "../../src/MosaicERC721.sol";

/// @dev EIP-712 voucher signing utilities for tests.
library VoucherSigner {
    bytes32 internal constant VOUCHER_TYPEHASH = keccak256(
        "NFTVoucher(uint256 nonce,uint256 minPrice,string uri,uint96 royaltyBps,address creator)"
    );

    /// @dev Build the EIP-712 domain separator matching MosaicERC721.
    function domainSeparator(address verifyingContract) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("MosaicNFT")),
                keccak256(bytes("1")),
                block.chainid,
                verifyingContract
            )
        );
    }

    /// @dev Compute the full EIP-712 digest for a voucher.
    function digest(
        address verifyingContract,
        uint256 nonce,
        uint256 minPrice,
        string memory uri,
        uint96 royaltyBps,
        address creator
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(VOUCHER_TYPEHASH, nonce, minPrice, keccak256(bytes(uri)), royaltyBps, creator)
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(verifyingContract), structHash));
    }

    /// @dev Sign a voucher with `signerKey` and return the populated struct.
    function sign(
        Vm vm,
        address verifyingContract,
        uint256 signerKey,
        uint256 nonce,
        uint256 minPrice,
        string memory uri,
        uint96 royaltyBps,
        address creator
    ) internal view returns (MosaicERC721.NFTVoucher memory voucher) {
        bytes32 d = digest(verifyingContract, nonce, minPrice, uri, royaltyBps, creator);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, d);
        voucher = MosaicERC721.NFTVoucher({
            nonce: nonce,
            minPrice: minPrice,
            uri: uri,
            royaltyBps: royaltyBps,
            creator: creator,
            signature: abi.encodePacked(r, s, v)
        });
    }
}
